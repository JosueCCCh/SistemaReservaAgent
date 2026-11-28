from contextlib import closing
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.db.database import _conectar
from app.db.seed import inicializar_bd
from app.modules.chat.agent import obtener_agente
from app.modules.disponibilidad import service as disponibilidad_service
from app.modules.laboratorios import service as laboratorios_service
from app.modules.reglamentos.service import buscar_reglamentos_fts, listar_documentos_fts
from app.modules.reservas import service as reservas_service

api_router = APIRouter()


class CrearReservaBody(BaseModel):
    laboratorioId: int
    fecha: str
    horaInicio: str
    horaFin: str
    codigoEstudiante: str
    nombre: str
    correo: str


class CancelarReservaBody(BaseModel):
    codigoEstudiante: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatBody(BaseModel):
    mensaje: str
    historial: list[ChatMessage] = []


# M0: Inicialización y Seed
@api_router.get("/seed")
def seed():
    try:
        inicializar_bd()
        labs = laboratorios_service.listar_todos()
        return {"ok": True, "mensaje": "Base de datos poblada exitosamente", "laboratorios": labs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# M1: Laboratorios
@api_router.get("/laboratorios")
def get_laboratorios():
    return laboratorios_service.listar_todos()


@api_router.get("/laboratorios/{lab_id}")
def get_laboratorio(lab_id: int):
    lab = laboratorios_service.obtener_por_id(lab_id)
    if not lab:
        raise HTTPException(status_code=404, detail="Laboratorio no encontrado")
    return lab


# M2: Inventario de equipos
@api_router.get("/equipos")
def get_equipos(
    laboratorioId: int | None = None,
    estado: str | None = None,
    q: str | None = None,
):
    sql = "SELECT e.*, l.nombre AS laboratorio_nombre FROM equipos e JOIN laboratorios l ON l.id = e.laboratorio_id WHERE 1=1"
    params = []
    if laboratorioId is not None:
        sql += " AND e.laboratorio_id = ?"
        params.append(laboratorioId)
    if estado:
        sql += " AND e.estado = ?"
        params.append(estado)
    if q:
        sql += " AND (e.nombre LIKE ? OR e.codigo LIKE ?)"
        params.extend([f"%{q}%", f"%{q}%"])
    sql += " ORDER BY e.id ASC"
    with closing(_conectar()) as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


# M3: Horarios de atención
@api_router.get("/laboratorios/{lab_id}/horarios")
def get_horarios(lab_id: int):
    with closing(_conectar()) as conn:
        rows = conn.execute(
            "SELECT * FROM horario_atencion WHERE laboratorio_id = ? ORDER BY dia_semana",
            (lab_id,),
        ).fetchall()
        return [dict(r) for r in rows]


# M4: Disponibilidad
@api_router.get("/disponibilidad")
def get_disponibilidad(
    laboratorioId: int | None = None,
    laboratorio_id: int | None = None,
    fecha: str | None = None,
):
    lab_id = laboratorioId if laboratorioId is not None else laboratorio_id
    if lab_id is None or not fecha:
        return JSONResponse(
            status_code=400,
            content={"error": "Parámetros laboratorioId y fecha son requeridos"},
        )
    return disponibilidad_service.calcular_disponibilidad(lab_id, fecha)


# M5: Reservas
@api_router.post("/reservas")
def post_reserva(body: CrearReservaBody):
    resultado = reservas_service.crear_reserva_por_lab(
        laboratorio=body.laboratorioId,
        fecha=body.fecha,
        hora_inicio=body.horaInicio,
        hora_fin=body.horaFin,
        codigo_estudiante=body.codigoEstudiante,
        nombre=body.nombre,
        correo=body.correo,
    )
    if not resultado.get("ok"):
        return JSONResponse(status_code=400, content=resultado)
    return JSONResponse(status_code=201, content=resultado)


@api_router.delete("/reservas/{reserva_id}")
def delete_reserva(reserva_id: int, body: CancelarReservaBody):
    if not body.codigoEstudiante:
        return JSONResponse(
            status_code=400,
            content={"ok": False, "motivo": "El código de estudiante es requerido para cancelar."},
        )
    resultado = reservas_service.cancelar_reserva(reserva_id, body.codigoEstudiante)
    if not resultado.get("ok"):
        return JSONResponse(status_code=400, content=resultado)
    return resultado


@api_router.get("/reservas")
def get_reservas(
    laboratorioId: int | None = None,
    laboratorio_id: int | None = None,
    codigoEstudiante: str | None = None,
    codigo: str | None = None,
    codigo_estudiante: str | None = None,
    fecha: str | None = None,
):
    lab_id = laboratorioId if laboratorioId is not None else laboratorio_id
    cod = codigoEstudiante or codigo or codigo_estudiante
    return reservas_service.listar_reservas(laboratorio_id=lab_id, fecha=fecha, codigo_estudiante=cod)


# M6: Calendario
@api_router.get("/calendario")
def get_calendario(
    laboratorioId: int | None = None,
    laboratorio_id: int | None = None,
    fecha: str | None = None,
):
    lab_id = laboratorioId if laboratorioId is not None else laboratorio_id
    if lab_id is None or not fecha:
        return JSONResponse(status_code=400, content={"error": "laboratorioId y fecha son requeridos"})
    lab = laboratorios_service.obtener_por_id(lab_id)
    if not lab:
        return JSONResponse(status_code=404, content={"error": "Laboratorio no encontrado"})
    datos = disponibilidad_service.obtener_datos_del_dia(lab["id"], fecha)
    return {"laboratorio": lab["nombre"], "fecha": fecha, "datos": datos}


# M7: Historial de correos
@api_router.get("/correos")
def get_correos(reservaId: int | None = None):
    sql = "SELECT * FROM correos"
    params = []
    if reservaId is not None:
        sql += " WHERE reserva_id = ?"
        params.append(reservaId)
    sql += " ORDER BY id DESC LIMIT 50"
    with closing(_conectar()) as conn:
        return [dict(r) for r in conn.execute(sql, params).fetchall()]


# M8: Reglamentos (RAG)
@api_router.get("/reglamentos/buscar")
def get_reglamentos_buscar(q: str = "", laboratorio: str = ""):
    return buscar_reglamentos_fts(q, laboratorio)


@api_router.get("/reglamentos/documentos")
def get_reglamentos_documentos():
    return listar_documentos_fts()


# M9: Asistente IA (Chatbot)
@api_router.post("/chat")
def post_chat(body: ChatBody):
    if not body.mensaje or not body.mensaje.strip():
        return JSONResponse(status_code=400, content={"error": "Mensaje requerido"})
    agente = obtener_agente()
    historial_dicts = [{"role": m.role, "content": m.content} for m in body.historial]
    respuesta = agente.procesar_mensaje(historial_dicts, body.mensaje)
    return {"respuesta": respuesta}
