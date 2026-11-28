from contextlib import closing
from app.db.database import _conectar
from app.utils.intervalos import _resolver_lab


def listar_todos() -> list[dict]:
    with closing(_conectar()) as conn:
        rows = conn.execute("SELECT * FROM laboratorios ORDER BY id").fetchall()
        return [dict(r) for r in rows]


def obtener_por_id(lab_id: int) -> dict | None:
    with closing(_conectar()) as conn:
        row = conn.execute("SELECT * FROM laboratorios WHERE id = ?", (lab_id,)).fetchone()
        return dict(row) if row else None


def resolver_lab(nombre: str) -> dict | None:
    with closing(_conectar()) as conn:
        row = _resolver_lab(conn, nombre)
        return dict(row) if row else None
