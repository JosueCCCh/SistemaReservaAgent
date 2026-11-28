import unicodedata
from datetime import datetime

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


def _a_min(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _a_hhmm(minutos: int) -> str:
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def _validar_hora(texto) -> int | None:
    """Devuelve los minutos, o None si no es HH:MM válido"""
    try:
        h, m = str(texto).strip().split(":")
        h, m = int(h), int(m)
        return h * 60 + m if 0 <= h <= 23 and 0 <= m <= 59 else None
    except ValueError:
        return None


def _validar_fecha(fecha) -> datetime | None:
    try:
        return datetime.strptime(str(fecha).strip(), "%Y-%m-%d")
    except ValueError:
        return None


def _norm(texto: str) -> str:
    """Minúsculas y sin tildes, para comparar nombres"""
    texto = unicodedata.normalize("NFD", texto.lower().strip())
    return "".join(c for c in texto if unicodedata.category(c) != "Mn")


def _resolver_lab(conn, nombre: str):
    """Encuentra el laboratorio aunque el usuario escriba 'circuitos' o 'lab de sistemas digitales'"""
    q = _norm(nombre)
    if len(q) < 3:
        return None
    for lab in conn.execute("SELECT * FROM laboratorios").fetchall():
        n = _norm(lab["nombre"])
        palabras = [w for w in n.split() if len(w) > 3]
        if q == n or q in n or n in q or any(w in q for w in palabras):
            return lab
    return None


def _unir(intervalos: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Une intervalos que se tocan o se superponen"""
    res = []
    for ini, fin in sorted(intervalos):
        if res and ini <= res[-1][1]:
            res[-1] = (res[-1][0], max(res[-1][1], fin))
        else:
            res.append((ini, fin))
    return res


def _restar(base: list[tuple[int, int]], bloqueados: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Intervalos de 'base' que quedan libres al quitar los 'bloqueados'"""
    libres = []
    bloqueados = _unir(bloqueados)
    for ini, fin in base:
        actual = ini
        for b_ini, b_fin in bloqueados:
            if b_fin <= actual or b_ini >= fin:
                continue
            if b_ini > actual:
                libres.append((actual, b_ini))
            actual = max(actual, b_fin)
        if actual < fin:
            libres.append((actual, fin))
    return libres


def _choca(ini: int, fin: int, bloques: list[tuple[int, int]]) -> bool:
    return any(a < fin and ini < b for a, b in bloques)


def _textos(intervalos: list[tuple[int, int]]) -> list[str]:
    return [f"{_a_hhmm(a)} a {_a_hhmm(b)}" for a, b in intervalos]


def _datos_del_dia(conn, lab_id: int, fecha: str):
    """Horario de atención, refrigerios, clases y reservas activas de un laboratorio en una fecha"""
    dia = datetime.strptime(fecha, "%Y-%m-%d").weekday()
    turnos = conn.execute(
        "SELECT * FROM horario_atencion WHERE laboratorio_id=? AND dia_semana=?",
        (lab_id, dia),
    ).fetchall()
    atencion = _unir([(_a_min(t["hora_inicio"]), _a_min(t["hora_fin"])) for t in turnos])
    refrigerios = [
        (_a_min(t["refrigerio_inicio"]), _a_min(t["refrigerio_fin"]))
        for t in turnos
        if t["refrigerio_inicio"] and t["refrigerio_fin"]
    ]
    clases = [
        (_a_min(c["hora_inicio"]), _a_min(c["hora_fin"]))
        for c in conn.execute(
            "SELECT * FROM bloques_clase WHERE laboratorio_id=? AND dia_semana=?",
            (lab_id, dia),
        ).fetchall()
    ]
    reservas = [
        (_a_min(r["hora_inicio"]), _a_min(r["hora_fin"]))
        for r in conn.execute(
            "SELECT * FROM reservas WHERE laboratorio_id=? AND fecha=? AND estado='activa'",
            (lab_id, fecha),
        ).fetchall()
    ]
    return atencion, refrigerios, clases, reservas
