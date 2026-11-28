import os
import re
from contextlib import closing
from app.config import COLLECTION_NAME, RAG_DB_PATH
from app.db.database import _conectar
from app.modules.disponibilidad.service import _lab_no_encontrado
from app.utils.intervalos import _resolver_lab
from app.utils.tool_logger import registrar_tool

try:
    import chromadb
except ImportError:
    chromadb = None

RAG_ACTIVO: "RAGVectorStore | None" = None


class RAGVectorStore:
    """Clase para cargar la base de datos vectorial (ChromaDB) igual que en Agente_IA_labs_urp.ipynb"""

    def __init__(self, persit_directory: str = RAG_DB_PATH, collection_name: str = COLLECTION_NAME):
        self.persit_directory = persit_directory
        self.collection_name = collection_name
        self.collection = None

        if chromadb is None or not os.path.exists(self.persit_directory):
            return

        self.client = chromadb.PersistentClient(path=self.persit_directory)
        try:
            self.collection = self.client.get_collection(collection_name)
            print("Coleccion ChromaDB cargada")
        except Exception as e:
            print(f"Error al cargar la coleccion ChromaDB: {e}")
            self.collection = None

    def search(self, query: str, n_results: int = 5, filter_metadata: dict | None = None):
        if not self.collection:
            return []
        try:
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results,
                where=filter_metadata,
            )
            documents = []
            if results["documents"] and results["documents"][0]:
                for i in range(len(results["documents"][0])):
                    meta = results["metadatas"][0][i] if results["metadatas"] else {}
                    doc = {
                        "text": results["documents"][0][i],
                        "metadata": meta,
                        "cita": self.formato_cita(meta),
                        "distance": results["distances"][0][i] if results["distances"] else None,
                    }
                    documents.append(doc)
            return documents
        except Exception as e:
            print(f"Error en la busqueda del RAG: {e}")
            return []

    @staticmethod
    def formato_cita(meta: dict) -> str:
        """Arma la cita: Documento (Art. 17)"""
        if "articulo" in meta:
            ref = meta["articulo"] if meta["articulo"] in ("general", "preámbulo") else f"Art. {meta['articulo']}"
        elif "seccion" in meta:
            ref = f"Sección {meta['seccion']}"
        else:
            ref = ""
        return f"{meta.get('documento', meta.get('source', ''))} ({ref})"

    def listar_documentos(self):
        if not self.collection:
            return []
        data = self.collection.get(include=["metadatas"])
        vistos = {}
        for m in data["metadatas"]:
            vistos[m["documento"]] = {
                "documento": m["documento"],
                "laboratorio": m["laboratorio"],
                "escuela": m["escuela"],
                "tipo": m["tipo"],
            }
        return list(vistos.values())

    def count(self) -> int:
        if self.collection:
            return self.collection.count()
        return 0


def buscar_reglamentos_fts(consulta: str, laboratorio: str = "") -> dict:
    """Búsqueda de respaldo en SQLite FTS5 cuando ChromaDB no está disponible"""
    if not consulta or not consulta.strip():
        return {"resultados": [], "nota": "Ingresa una consulta para buscar."}

    lab_filtrado = None
    if laboratorio.strip():
        with closing(_conectar()) as conn:
            lab = _resolver_lab(conn, laboratorio)
            if not lab:
                return _lab_no_encontrado(conn)
            lab_filtrado = lab["nombre"]

    palabras = [w for w in re.sub(r"['\"\\/*?^:;~()\-+]", " ", consulta).split() if len(w) > 2]
    sanitized_query = " OR ".join(palabras)
    if not sanitized_query:
        return {"resultados": [], "nota": "La consulta no contiene términos de búsqueda válidos."}

    sql = """
        SELECT documento, laboratorio, escuela, tipo, referencia, texto, rank
        FROM reglamento_fragmentos
        WHERE reglamento_fragmentos MATCH ?
    """
    params = [sanitized_query]
    if lab_filtrado:
        sql += " AND laboratorio = ?"
        params.append(lab_filtrado)
    sql += " ORDER BY rank LIMIT 5"

    with closing(_conectar()) as conn:
        rows = conn.execute(sql, params).fetchall()
        if not rows:
            like_sql = """
                SELECT documento, laboratorio, escuela, tipo, referencia, texto
                FROM reglamento_fragmentos
                WHERE texto LIKE ?
            """
            like_params = [f"%{consulta.strip()}%"]
            if lab_filtrado:
                like_sql += " AND laboratorio = ?"
                like_params.append(lab_filtrado)
            like_sql += " LIMIT 5"
            rows = conn.execute(like_sql, like_params).fetchall()

        if not rows:
            return {"resultados": [], "nota": "No se encontró información en los documentos."}

        return {
            "resultados": [
                {
                    "cita": f"{r['documento']} ({r['referencia']})",
                    "laboratorio": r["laboratorio"],
                    "escuela": r["escuela"],
                    "tipo": r["tipo"],
                    "texto": r["texto"][:1500],
                }
                for r in rows
            ]
        }


def listar_documentos_fts() -> dict:
    with closing(_conectar()) as conn:
        rows = conn.execute(
            "SELECT DISTINCT documento, laboratorio, escuela, tipo FROM reglamento_fragmentos ORDER BY laboratorio, documento"
        ).fetchall()
        docs = [dict(r) for r in rows]
        labs = sorted({d["laboratorio"] for d in docs})
        return {"laboratorios": labs, "documentos": docs}


# ---------- TOOLS DEL AGENTE (Módulo Reglamentos / RAG) ----------
def buscar_reglamento(consulta: str, laboratorio: str = "") -> dict:
    """Busca en los reglamentos y manuales de los laboratorios de la URP (RAG) y devuelve fragmentos con su cita (documento y artículo).
    Úsala para normas, seguridad, procedimientos, préstamo de equipos, tolerancia de ingreso, recuperación de experimentos, taller de circuitos impresos, etc.

    Args:
      consulta: la pregunta o tema a buscar, en español.
      laboratorio: laboratorio al que se refiere el usuario (Circuitos, Sistemas Digitales, Telecomunicaciones, CIM o Metal Mecánica). Vacío si no menciona ninguno.
    """
    registrar_tool("buscar_reglamento", consulta=consulta, laboratorio=laboratorio)
    if RAG_ACTIVO and RAG_ACTIVO.count() > 0:
        filtro = None
        if laboratorio.strip():
            with closing(_conectar()) as conn:
                lab = _resolver_lab(conn, laboratorio)
                if not lab:
                    return _lab_no_encontrado(conn)
                filtro = {"laboratorio": lab["nombre"]}
        resultados = RAG_ACTIVO.search(consulta, n_results=5, filter_metadata=filtro)
        if not resultados:
            return {"resultados": [], "nota": "No se encontró información en los documentos."}
        salida = []
        for r in resultados:
            item = {
                "cita": r["cita"],
                "laboratorio": r["metadata"].get("laboratorio", ""),
                "texto": r["text"][:1500],
            }
            if r["distance"] is not None:
                item["relevancia"] = round(1 - r["distance"], 3)
            salida.append(item)
        return {"resultados": salida}
    return buscar_reglamentos_fts(consulta, laboratorio)


def listar_documentos() -> dict:
    """Devuelve los documentos y laboratorios reales que hay en la base de conocimiento. Úsala cuando pregunten qué documentos, reglamentos o laboratorios hay."""
    registrar_tool("listar_documentos")
    if RAG_ACTIVO and RAG_ACTIVO.count() > 0:
        docs = RAG_ACTIVO.listar_documentos()
        labs = sorted({d["laboratorio"] for d in docs})
        return {"laboratorios": labs, "documentos": docs}
    return listar_documentos_fts()
