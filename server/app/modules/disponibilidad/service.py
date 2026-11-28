from contextlib import closing
from datetime import datetime
from app.config import ZONA_HORARIA
from app.db.database import _conectar
from app.utils.intervalos import (
    DIAS,
    _datos_del_dia,
    _resolver_lab,
    _restar,
    _textos,
    _validar_fecha,
)
from app.utils.tool_logger import registrar_tool


def _lab_no_encontrado(conn) -> dict:
    nombres = [l["nombre"] for l in conn.execute("SELECT nombre FROM laboratorios").fetchall()]
    return {"error": "No reconozco ese laboratorio.", "laboratorios_validos": nombres}


def _sin_reservas(lab) -> dict:
    return {
        "error": f"{lab['nombre']} no contempla reservas de horas libres; solo se puede consultar su reglamento y manual (usa buscar_reglamento)."
    }


def obtener_datos_del_dia(lab_id: int, fecha: str) -> dict:
    if _validar_fecha(fecha) is None:
        raise ValueError("Fecha inválida")
    with closing(_conectar()) as conn:
        atencion, refrigerios, clases, reservas = _datos_del_dia(conn, lab_id, fecha)
        return {
            "atencion": [list(x) for x in atencion],
            "refrigerios": [list(x) for x in refrigerios],
            "clases": [list(x) for x in clases],
            "reservas": [list(x) for x in reservas],
        }


def calcular_disponibilidad(laboratorio: str | int, fecha: str) -> dict:
    dt = _validar_fecha(fecha)
    if dt is None:
        return {"error": "Fecha inválida, usa el formato AAAA-MM-DD."}

    with closing(_conectar()) as conn:
        if isinstance(laboratorio, int):
            lab = conn.execute("SELECT * FROM laboratorios WHERE id = ?", (laboratorio,)).fetchone()
        else:
            lab = _resolver_lab(conn, str(laboratorio))

        if not lab:
            return _lab_no_encontrado(conn)
        if not lab["permite_reserva"]:
            return _sin_reservas(lab)

        atencion, refrigerios, clases, reservas = _datos_del_dia(conn, lab["id"], fecha)
        libres = _restar(atencion, refrigerios + clases + reservas)

        # Si la fecha consultada es HOY (hora Lima), recortar horas que ya pasaron
        ahora = datetime.now(ZONA_HORARIA)
        hoy_fecha = ahora.strftime("%Y-%m-%d")
        hoy_min = ahora.hour * 60 + ahora.minute
        if fecha == hoy_fecha:
            libres = [
                (max(ini, hoy_min), fin)
                for ini, fin in libres
                if fin > hoy_min and (fin - max(ini, hoy_min)) >= 30
            ]
        elif fecha < hoy_fecha:
            libres = []

        dia = DIAS[dt.weekday()]
        if not atencion:
            return {
                "laboratorio": lab["nombre"],
                "laboratorio_id": lab["id"],
                "fecha": fecha,
                "dia": dia,
                "horas_libres": [],
                "nota": "El laboratorio no atiende ese día.",
            }
        return {
            "laboratorio": lab["nombre"],
            "laboratorio_id": lab["id"],
            "fecha": fecha,
            "dia": dia,
            "horario_atencion": _textos(atencion),
            "horas_libres": _textos(libres),
        }


# ---------- TOOL DEL AGENTE (Módulo Disponibilidad) ----------
def consultar_disponibilidad(laboratorio: str, fecha: str) -> dict:
    """Devuelve las horas libres de un laboratorio en una fecha. Una hora está libre si cae dentro del horario de atención, fuera del refrigerio del personal, sin clase y sin reserva activa. Solo Circuitos y Dispositivos y Sistemas Digitales tienen horas libres reservables.

    Args:
      laboratorio: nombre del laboratorio.
      fecha: fecha en formato AAAA-MM-DD.
    """
    registrar_tool("consultar_disponibilidad", laboratorio=laboratorio, fecha=fecha)
    return calcular_disponibilidad(laboratorio, fecha)
