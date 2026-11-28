from contextlib import closing
from datetime import datetime
from app.config import ZONA_HORARIA
from app.db.database import _conectar
from app.modules.disponibilidad.service import _lab_no_encontrado, _sin_reservas
from app.modules.notificaciones.service import _enviar_correo, _validar_correo
from app.utils.intervalos import (
    _a_hhmm,
    _a_min,
    _choca,
    _datos_del_dia,
    _norm,
    _resolver_lab,
    _restar,
    _textos,
    _validar_fecha,
    _validar_hora,
)
from app.utils.tool_logger import registrar_tool


def crear_reserva_por_lab(
    laboratorio: str | int,
    fecha: str,
    hora_inicio: str,
    hora_fin: str,
    codigo_estudiante: str,
    nombre: str,
    correo: str,
) -> dict:
    f = _validar_fecha(fecha)
    ini = _validar_hora(hora_inicio)
    fin = _validar_hora(hora_fin)
    if f is None or ini is None or fin is None:
        return {"ok": False, "motivo": "Fecha u hora inválida. Usa AAAA-MM-DD y HH:MM (24 horas)."}
    if fin <= ini:
        return {"ok": False, "motivo": "La hora de fin debe ser posterior a la de inicio."}
    if not str(codigo_estudiante).strip() or not str(nombre).strip():
        return {"ok": False, "motivo": "Faltan el código y el nombre del estudiante."}

    correo = str(correo).strip().lower()
    if not _validar_correo(correo):
        return {
            "ok": False,
            "motivo": "Falta un correo electrónico válido del estudiante (o su dominio no está permitido). Pídeselo.",
        }

    ahora = datetime.now(ZONA_HORARIA)
    if f.date() < ahora.date() or (f.date() == ahora.date() and ini < ahora.hour * 60 + ahora.minute):
        return {"ok": False, "motivo": "No se puede reservar en una fecha u hora que ya pasó."}

    with closing(_conectar()) as conn:
        if isinstance(laboratorio, int):
            lab = conn.execute("SELECT * FROM laboratorios WHERE id = ?", (laboratorio,)).fetchone()
        else:
            lab = _resolver_lab(conn, str(laboratorio))

        if not lab:
            return _lab_no_encontrado(conn)
        if not lab["permite_reserva"]:
            return {"ok": False, "motivo": _sin_reservas(lab)["error"]}

        atencion, refrigerios, clases, reservas = _datos_del_dia(conn, lab["id"], fecha)
        libres = _restar(atencion, refrigerios + clases + reservas)

        if not any(a <= ini and fin <= b for a, b in libres):
            # Verificar si el choque es con una reserva del mismo estudiante
            mis_reservas = conn.execute(
                "SELECT id, hora_inicio, hora_fin FROM reservas WHERE laboratorio_id=? AND fecha=? AND estado='activa' AND codigo_estudiante=?",
                (lab["id"], fecha, str(codigo_estudiante).strip()),
            ).fetchall()
            for mr in mis_reservas:
                if ini < _a_min(mr["hora_fin"]) and fin > _a_min(mr["hora_inicio"]):
                    return {
                        "ok": False,
                        "motivo": f"Ya tienes registrada la reserva n.º {mr['id']} para este mismo laboratorio y horario ({mr['hora_inicio']} a {mr['hora_fin']}).",
                        "horas_libres_ese_dia": _textos(libres),
                        "es_mi_reserva": True,
                        "reserva_id": mr["id"],
                    }

            motivos = []
            if not any(a <= ini and fin <= b for a, b in atencion):
                motivos.append("está fuera del horario de atención del laboratorio")
            if _choca(ini, fin, refrigerios):
                motivos.append("coincide con el refrigerio del personal")
            if _choca(ini, fin, clases):
                motivos.append("hay clase en ese horario")
            if _choca(ini, fin, reservas):
                motivos.append("ya hay una reserva en ese horario")
            if not motivos:
                motivos.append("no está completamente libre")
            return {
                "ok": False,
                "motivo": "Ese horario " + " y ".join(motivos) + ".",
                "horas_libres_ese_dia": _textos(libres),
            }

        cur = conn.execute(
            "INSERT INTO reservas (laboratorio_id,fecha,hora_inicio,hora_fin,codigo_estudiante,nombre,correo,estado,creada_en) VALUES (?,?,?,?,?,?,?,?,?)",
            (
                lab["id"],
                fecha,
                _a_hhmm(ini),
                _a_hhmm(fin),
                str(codigo_estudiante).strip(),
                str(nombre).strip(),
                correo,
                "activa",
                ahora.isoformat(),
            ),
        )
        conn.commit()
        envio = _enviar_correo(conn, "confirmacion", cur.lastrowid)
        return {
            "ok": True,
            "reserva_id": cur.lastrowid,
            "laboratorio": lab["nombre"],
            "fecha": fecha,
            "hora_inicio": _a_hhmm(ini),
            "hora_fin": _a_hhmm(fin),
            "estudiante": str(nombre).strip(),
            "correo_destinatario": envio["destinatario"],
            "correo_estado": envio["estado"],
            "recordatorios": [
                "Dejar el carné universitario vigente (Art. 28 a).",
                "Registrar el uso en la hoja de Control de Uso de los Ambientes (Horas Libres) (Art. 28 c).",
                "La hora libre puede cancelarse por razones académicas o de mantenimiento (Art. 28 b).",
                "Prohibido ingresar alimentos y bebidas, y fumar (Art. 20).",
            ],
        }


def crear_reserva(
    laboratorio: str,
    fecha: str,
    hora_inicio: str,
    hora_fin: str,
    codigo_estudiante: str,
    nombre: str,
    correo: str,
) -> dict:
    """Registra la reserva de una hora libre de estudiante en Circuitos y Dispositivos o Sistemas Digitales. El sistema valida las reglas y puede rechazarla. Si la guarda, el sistema envía solo un correo de confirmación al estudiante.

    Args:
      laboratorio: nombre del laboratorio.
      fecha: fecha en formato AAAA-MM-DD.
      hora_inicio: hora de inicio en formato HH:MM de 24 horas.
      hora_fin: hora de fin en formato HH:MM de 24 horas.
      codigo_estudiante: código del estudiante.
      nombre: nombre completo del estudiante.
      correo: correo electrónico del estudiante, donde se envía la confirmación.
    """
    registrar_tool(
        "crear_reserva",
        laboratorio=laboratorio,
        fecha=fecha,
        hora_inicio=hora_inicio,
        hora_fin=hora_fin,
        codigo_estudiante=codigo_estudiante,
        nombre=nombre,
        correo=correo,
    )
    return crear_reserva_por_lab(
        laboratorio, fecha, hora_inicio, hora_fin, codigo_estudiante, nombre, correo
    )


def cancelar_reserva(reserva_id: int, codigo_estudiante: str) -> dict:
    """Anula una reserva activa. Solo la puede cancelar el estudiante que la hizo. Si la anula, el sistema envía solo un correo de cancelación.

    Args:
      reserva_id: número de la reserva.
      codigo_estudiante: código del estudiante que hizo la reserva.
    """
    registrar_tool("cancelar_reserva", reserva_id=reserva_id, codigo_estudiante=codigo_estudiante)
    with closing(_conectar()) as conn:
        r = conn.execute(
            "SELECT r.*, l.nombre AS lab FROM reservas r JOIN laboratorios l ON l.id = r.laboratorio_id WHERE r.id=?",
            (int(reserva_id),),
        ).fetchone()
        if not r:
            return {"ok": False, "motivo": "No existe una reserva con ese número."}
        if _norm(r["codigo_estudiante"]) != _norm(codigo_estudiante):
            return {
                "ok": False,
                "motivo": "El código no coincide con el de la reserva. Es una regla del sistema de reservas (no del reglamento): solo quien reservó puede cancelarla.",
            }
        if r["estado"] != "activa":
            return {"ok": False, "motivo": "Esa reserva ya estaba cancelada."}
        conn.execute("UPDATE reservas SET estado='cancelada' WHERE id=?", (r["id"],))
        conn.commit()
        envio = _enviar_correo(conn, "cancelacion", r["id"])
        return {
            "ok": True,
            "reserva_id": r["id"],
            "laboratorio": r["lab"],
            "fecha": r["fecha"],
            "hora_inicio": r["hora_inicio"],
            "hora_fin": r["hora_fin"],
            "correo_destinatario": envio["destinatario"],
            "correo_estado": envio["estado"],
        }


def listar_reservas(
    laboratorio_id: int | None = None,
    fecha: str | None = None,
    codigo_estudiante: str | None = None,
) -> list[dict]:
    sql = """
        SELECT r.*, l.nombre AS laboratorio_nombre
        FROM reservas r
        JOIN laboratorios l ON l.id = r.laboratorio_id
        WHERE 1=1
    """
    params = []
    if laboratorio_id:
        sql += " AND r.laboratorio_id = ?"
        params.append(laboratorio_id)
    if fecha:
        sql += " AND r.fecha = ?"
        params.append(fecha)
    if codigo_estudiante:
        sql += " AND r.codigo_estudiante = ?"
        params.append(codigo_estudiante.strip())
    sql += " ORDER BY r.fecha DESC, r.hora_inicio ASC"

    with closing(_conectar()) as conn:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]


def consultar_calendario(laboratorio: str, fecha: str) -> dict:
    """Lista las reservas activas de un laboratorio en un día, con los equipos de cada una (solo consulta).

    Args:
      laboratorio: nombre del laboratorio.
      fecha: fecha en formato AAAA-MM-DD.
    """
    registrar_tool("consultar_calendario", laboratorio=laboratorio, fecha=fecha)
    if _validar_fecha(fecha) is None:
        return {"error": "Fecha inválida, usa el formato AAAA-MM-DD."}
    with closing(_conectar()) as conn:
        lab = _resolver_lab(conn, laboratorio)
        if not lab:
            return _lab_no_encontrado(conn)
        if not lab["permite_reserva"]:
            return _sin_reservas(lab)
        filas = conn.execute(
            "SELECT * FROM reservas WHERE laboratorio_id=? AND fecha=? AND estado='activa' ORDER BY hora_inicio",
            (lab["id"], fecha),
        ).fetchall()
        reservas = []
        for r in filas:
            eqs = conn.execute(
                """SELECT e.nombre, e.codigo FROM reservas_equipo re JOIN equipos e ON e.id = re.equipo_id
                   WHERE re.reserva_id=? AND re.estado='activa' ORDER BY e.codigo""",
                (r["id"],),
            ).fetchall()
            reservas.append(
                {
                    "reserva_id": r["id"],
                    "hora_inicio": r["hora_inicio"],
                    "hora_fin": r["hora_fin"],
                    "estudiante": r["nombre"],
                    "equipos": [f"{e['nombre']} ({e['codigo']})" for e in eqs],
                }
            )
        return {"laboratorio": lab["nombre"], "fecha": fecha, "reservas": reservas}


# ---------- EQUIPOS ----------
def _tokens(texto: str) -> list[str]:
    """Palabras significativas (3 o más letras) de un texto, sin tildes"""
    return [w for w in _norm(texto).replace("-", " ").split() if len(w) >= 3]


def _coincide(a: str, b: str) -> bool:
    """Tolera plurales: 'osciloscopios' coincide con 'osciloscopio'"""
    return a.startswith(b) or b.startswith(a)


def _equipo_coincide(texto: str, e) -> bool:
    """True si el texto es el código del equipo o todas sus palabras aparecen en el nombre"""
    if _norm(texto) == _norm(e["codigo"]):
        return True
    tokens = _tokens(texto)
    return bool(tokens) and all(any(_coincide(w, t) for t in _tokens(e["nombre"])) for w in tokens)


def _resolver_equipo(conn, lab_id: int, texto: str):
    equipos = conn.execute("SELECT * FROM equipos WHERE laboratorio_id=? ORDER BY codigo", (lab_id,)).fetchall()
    return [e for e in equipos if _equipo_coincide(texto, e)]


def _ids_ocupados(conn, fecha: str, ini: int, fin: int) -> set[int]:
    """IDs de equipos que ya están en una reserva activa que se cruza con ese horario"""
    filas = conn.execute(
        """SELECT re.equipo_id, r.hora_inicio, r.hora_fin FROM reservas_equipo re
           JOIN reservas r ON r.id = re.reserva_id
           WHERE re.estado='activa' AND r.estado='activa' AND r.fecha=?""",
        (fecha,),
    ).fetchall()
    return {
        f["equipo_id"]
        for f in filas
        if _choca(ini, fin, [(_a_min(f["hora_inicio"]), _a_min(f["hora_fin"]))])
    }


def consultar_equipos(
    laboratorio: str,
    equipo: str = "",
    fecha: str = "",
    hora_inicio: str = "",
    hora_fin: str = "",
) -> dict:
    """Consulta los equipos de Circuitos y Dispositivos o Sistemas Digitales: cuántos hay de cada tipo, cuántos están operativos o en mantenimiento y, si se indican fecha, hora_inicio y hora_fin, cuántos están disponibles en ese horario (no reservados por otros). Para reservar un equipo el estudiante necesita además una reserva de hora libre.

    Args:
      laboratorio: nombre del laboratorio.
      equipo: tipo o código de equipo a consultar (por ejemplo osciloscopio o CIR-OSC-01). Vacío para ver todos los tipos.
      fecha: fecha en formato AAAA-MM-DD (opcional).
      hora_inicio: hora de inicio HH:MM de 24 horas (opcional).
      hora_fin: hora de fin HH:MM de 24 horas (opcional).
    """
    registrar_tool(
        "consultar_equipos",
        laboratorio=laboratorio,
        equipo=equipo,
        fecha=fecha,
        hora_inicio=hora_inicio,
        hora_fin=hora_fin,
    )
    with closing(_conectar()) as conn:
        lab = _resolver_lab(conn, laboratorio)
        if not lab:
            return _lab_no_encontrado(conn)
        if not lab["permite_reserva"]:
            return {"error": f"{lab['nombre']} no tiene equipos reservables en este sistema."}

        con_horario = bool(fecha and hora_inicio and hora_fin)
        ocupados = set()
        if con_horario:
            ini, fin = _validar_hora(hora_inicio), _validar_hora(hora_fin)
            if _validar_fecha(fecha) is None or ini is None or fin is None or fin <= ini:
                return {"error": "Fecha u hora inválida. Usa AAAA-MM-DD y HH:MM (24 horas)."}
            ocupados = _ids_ocupados(conn, fecha, ini, fin)

        if equipo.strip():
            equipos = _resolver_equipo(conn, lab["id"], equipo)
            if not equipos:
                tipos = [
                    r["nombre"]
                    for r in conn.execute(
                        "SELECT DISTINCT nombre FROM equipos WHERE laboratorio_id=? ORDER BY nombre",
                        (lab["id"],),
                    )
                ]
                return {"error": f"No hay ese equipo en {lab['nombre']}.", "tipos_de_equipo": tipos}
        else:
            equipos = conn.execute(
                "SELECT * FROM equipos WHERE laboratorio_id=? ORDER BY codigo", (lab["id"],)
            ).fetchall()

        tipos = {}
        for e in equipos:
            t = tipos.setdefault(
                e["nombre"],
                {"equipo": e["nombre"], "total": 0, "operativos": 0, "en_mantenimiento": 0},
            )
            if con_horario:
                t.setdefault("disponibles", 0)
            t["total"] += 1
            if e["estado"] == "operativo":
                t["operativos"] += 1
                if con_horario and e["id"] not in ocupados:
                    t["disponibles"] += 1
            else:
                t["en_mantenimiento"] += 1

        salida = {"laboratorio": lab["nombre"], "tipos": list(tipos.values())}
        if equipo.strip():
            unidades = []
            for e in equipos:
                u = {"codigo": e["codigo"], "estado": e["estado"]}
                if con_horario:
                    u["disponible"] = (e["estado"] == "operativo") and (e["id"] not in ocupados)
                unidades.append(u)
            salida["unidades"] = unidades
        if con_horario:
            salida["horario_consultado"] = f"{fecha} de {hora_inicio} a {hora_fin}"
        return salida


def reservar_equipo(reserva_id: int, codigo_estudiante: str, equipo: str, cantidad: int = 1) -> dict:
    """Reserva uno o varios equipos para una reserva de hora libre ya existente; usa el mismo laboratorio, fecha y horario de esa reserva. Si hay varios equipos del mismo tipo, asigna los que estén libres. Si se guarda, el sistema envía solo un correo con los equipos de la reserva.

    Args:
      reserva_id: número de la reserva de hora libre a la que se agregan los equipos.
      codigo_estudiante: código del estudiante dueño de la reserva.
      equipo: tipo de equipo (por ejemplo osciloscopio) o código exacto (por ejemplo CIR-OSC-01).
      cantidad: cuántas unidades reservar (por defecto 1).
    """
    registrar_tool(
        "reservar_equipo",
        reserva_id=reserva_id,
        codigo_estudiante=codigo_estudiante,
        equipo=equipo,
        cantidad=cantidad,
    )
    cantidad = int(cantidad)
    if cantidad < 1:
        return {"ok": False, "motivo": "La cantidad debe ser al menos 1."}

    with closing(_conectar()) as conn:
        r = conn.execute(
            "SELECT r.*, l.nombre AS lab FROM reservas r JOIN laboratorios l ON l.id = r.laboratorio_id WHERE r.id=?",
            (int(reserva_id),),
        ).fetchone()
        if not r:
            return {"ok": False, "motivo": "No existe una reserva con ese número. Primero hay que reservar la hora libre."}
        if _norm(r["codigo_estudiante"]) != _norm(codigo_estudiante):
            return {
                "ok": False,
                "motivo": "El código no coincide con el de la reserva. Es una regla del sistema de reservas (no del reglamento): solo quien reservó puede agregarle equipos.",
            }
        if r["estado"] != "activa":
            return {"ok": False, "motivo": "Esa reserva está cancelada."}

        ahora = datetime.now(ZONA_HORARIA)
        hoy = ahora.strftime("%Y-%m-%d")
        if r["fecha"] < hoy or (r["fecha"] == hoy and _a_min(r["hora_fin"]) <= ahora.hour * 60 + ahora.minute):
            return {"ok": False, "motivo": "Esa reserva ya pasó."}

        candidatos = _resolver_equipo(conn, r["laboratorio_id"], equipo)
        if not candidatos:
            tipos = [
                x["nombre"]
                for x in conn.execute(
                    "SELECT DISTINCT nombre FROM equipos WHERE laboratorio_id=? ORDER BY nombre",
                    (r["laboratorio_id"],),
                )
            ]
            return {"ok": False, "motivo": f"No encuentro ese equipo en {r['lab']}.", "tipos_de_equipo": tipos}

        nombres = sorted({e["nombre"] for e in candidatos})
        if len(nombres) > 1:
            return {
                "ok": False,
                "motivo": "Ese texto coincide con varios tipos de equipo; pídele al estudiante que elija uno.",
                "opciones": nombres,
            }

        operativos = [e for e in candidatos if e["estado"] == "operativo"]
        if not operativos:
            return {"ok": False, "motivo": f"{nombres[0]} no está operativo (en mantenimiento)."}

        ini, fin = _a_min(r["hora_inicio"]), _a_min(r["hora_fin"])
        ocupados = _ids_ocupados(conn, r["fecha"], ini, fin)
        libres = [e for e in operativos if e["id"] not in ocupados]
        if len(libres) < cantidad:
            return {
                "ok": False,
                "motivo": f"Solo hay {len(libres)} disponible(s) de {nombres[0]} de {r['hora_inicio']} a {r['hora_fin']} y se pidieron {cantidad}.",
                "disponibles": len(libres),
            }

        elegidos = libres[:cantidad]
        for e in elegidos:
            conn.execute(
                "INSERT INTO reservas_equipo (reserva_id,equipo_id,estado,creada_en) VALUES (?,?,?,?)",
                (r["id"], e["id"], "activa", ahora.isoformat()),
            )
        conn.commit()
        envio = _enviar_correo(conn, "equipos", r["id"])
        return {
            "ok": True,
            "reserva_id": r["id"],
            "laboratorio": r["lab"],
            "fecha": r["fecha"],
            "hora_inicio": r["hora_inicio"],
            "hora_fin": r["hora_fin"],
            "equipos_reservados": [{"equipo": e["nombre"], "codigo_equipo": e["codigo"]} for e in elegidos],
            "correo_destinatario": envio["destinatario"],
            "correo_estado": envio["estado"],
        }


def cancelar_reserva_equipo(reserva_id: int, codigo_estudiante: str, equipo: str = "", cantidad: int = 0) -> dict:
    """Quita equipos de una reserva de hora libre; la reserva se mantiene. Solo el dueño de la reserva puede hacerlo. Si se quita algo, el sistema envía solo un correo con los equipos que quedan.

    Args:
      reserva_id: número de la reserva de hora libre.
      codigo_estudiante: código del estudiante dueño de la reserva.
      equipo: tipo o código del equipo a quitar (vacío = todos los equipos de la reserva).
      cantidad: cuántas unidades quitar (0 = todas las que coincidan; usa 1 si pidió quitar "un" equipo).
    """
    registrar_tool(
        "cancelar_reserva_equipo",
        reserva_id=reserva_id,
        codigo_estudiante=codigo_estudiante,
        equipo=equipo,
        cantidad=cantidad,
    )
    with closing(_conectar()) as conn:
        r = conn.execute("SELECT * FROM reservas WHERE id=?", (int(reserva_id),)).fetchone()
        if not r:
            return {"ok": False, "motivo": "No existe una reserva con ese número."}
        if _norm(r["codigo_estudiante"]) != _norm(codigo_estudiante):
            return {
                "ok": False,
                "motivo": "El código no coincide con el de la reserva. Es una regla del sistema de reservas (no del reglamento).",
            }

        filas = conn.execute(
            """SELECT re.id AS re_id, e.nombre, e.codigo FROM reservas_equipo re JOIN equipos e ON e.id = re.equipo_id
               WHERE re.reserva_id=? AND re.estado='activa' ORDER BY e.codigo""",
            (r["id"],),
        ).fetchall()
        if not filas:
            return {"ok": False, "motivo": "Esa reserva no tiene equipos activos."}

        if equipo.strip():
            filas = [f for f in filas if _equipo_coincide(equipo, {"codigo": f["codigo"], "nombre": f["nombre"]})]
            if not filas:
                return {"ok": False, "motivo": "Esa reserva no tiene ese equipo."}

        if int(cantidad) > 0:
            filas = filas[: int(cantidad)]

        for f in filas:
            conn.execute("UPDATE reservas_equipo SET estado='cancelada' WHERE id=?", (f["re_id"],))
        conn.commit()
        envio = _enviar_correo(conn, "equipos", r["id"])
        return {
            "ok": True,
            "reserva_id": r["id"],
            "equipos_cancelados": [{"equipo": f["nombre"], "codigo_equipo": f["codigo"]} for f in filas],
            "correo_destinatario": envio["destinatario"],
            "correo_estado": envio["estado"],
        }
