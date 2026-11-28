from contextlib import closing
from app.db.database import _conectar, init_schema


def inicializar_bd():
    """Crea las tablas y carga los datos. Borra lo anterior (reservas incluidas)"""
    with closing(_conectar()) as conn:
        conn.executescript(
            """
            DROP TABLE IF EXISTS correos;
            DROP TABLE IF EXISTS reservas_equipo;
            DROP TABLE IF EXISTS reservas;
            DROP TABLE IF EXISTS bloques_clase;
            DROP TABLE IF EXISTS horario_atencion;
            DROP TABLE IF EXISTS equipos;
            DROP TABLE IF EXISTS laboratorios;
            """
        )
        init_schema(conn)

        # permite_reserva = 0 en Telecomunicaciones (su reglamento no contempla horas libres), CIM y Metal Mecánica (solo consulta)
        conn.executemany(
            "INSERT INTO laboratorios VALUES (?,?,?,?)",
            [
                (1, "Circuitos y Dispositivos", "Electrónica", 1),
                (2, "Sistemas Digitales", "Electrónica", 1),
                (3, "Telecomunicaciones", "Electrónica", 0),
                (4, "CIM", "Industrial", 0),
                (5, "Metal Mecánica", "Industrial", 0),
            ],
        )

        # --- Horario de atención REAL (carteles, 23-nov-2026): (lab, día, inicio, fin, refrigerio_ini, refrigerio_fin)
        horarios = []
        for d in range(5):  # Circuitos lunes a viernes
            horarios.append((1, d, "08:00", "17:00", "13:00", "14:00"))
        horarios.append((1, 5, "07:30", "16:30", "13:00", "14:00"))  # Circuitos sábado
        for d in range(5):  # Sistemas Digitales: turno mañana y turno tarde
            horarios.append((2, d, "08:00", "15:30", "13:00", "13:30"))
            horarios.append((2, d, "14:30", "22:00", "18:00", "18:30"))
        conn.executemany(
            "INSERT INTO horario_atencion (laboratorio_id,dia_semana,hora_inicio,hora_fin,refrigerio_inicio,refrigerio_fin) VALUES (?,?,?,?,?,?)",
            horarios,
        )

        # --- Ocupación por clases SIMULADA
        clases = []
        for d in (0, 2, 4):  # Circuitos lun/mié/vie
            clases += [(1, d, "08:00", "10:00"), (1, d, "14:00", "16:00")]
        for d in (1, 3):  # Circuitos mar/jue
            clases += [(1, d, "10:00", "12:00"), (1, d, "15:00", "17:00")]
        clases.append((1, 5, "07:30", "09:30"))  # Circuitos sábado
        for d in (0, 2):  # Sistemas Digitales lun/mié
            clases += [(2, d, "08:00", "10:00"), (2, d, "18:30", "20:30")]
        for d in (1, 3):  # Sistemas Digitales mar/jue
            clases += [(2, d, "10:00", "12:00"), (2, d, "16:00", "18:00")]
        clases.append((2, 4, "08:00", "10:00"))  # Sistemas Digitales viernes
        conn.executemany(
            "INSERT INTO bloques_clase (laboratorio_id,dia_semana,hora_inicio,hora_fin) VALUES (?,?,?,?)",
            clases,
        )

        # --- Equipos de EJEMPLO (simulados): varias unidades por tipo, algunas en mantenimiento
        equipos = []

        def _agregar(lab, prefijo, nombre, cantidad, mantenimiento=()):
            for n in range(1, cantidad + 1):
                equipos.append(
                    (lab, f"{prefijo}-{n:02d}", nombre, "mantenimiento" if n in mantenimiento else "operativo")
                )

        _agregar(1, "CIR-OSC", "Osciloscopio digital", 4, (4,))
        _agregar(1, "CIR-GEN", "Generador de funciones", 3)
        _agregar(1, "CIR-FUE", "Fuente DC regulable", 4)
        _agregar(1, "CIR-MUL", "Multímetro digital", 6, (6,))
        _agregar(2, "SD-PRO", "Kit de desarrollo FPGA", 6, (6,))
        _agregar(2, "SD-ANA", "Analizador lógico", 3)
        _agregar(2, "SD-FUE", "Fuente DC regulable", 4)
        conn.executemany(
            "INSERT INTO equipos (laboratorio_id,codigo,nombre,estado) VALUES (?,?,?,?)",
            equipos,
        )

        # --- Fragmentos de reglamentos (FTS5 fallback si no hay ChromaDB)
        check_count = conn.execute("SELECT count(*) as count FROM reglamento_fragmentos").fetchone()["count"]
        if check_count == 0:
            reglamentos = [
                (
                    "Reglamento del Laboratorio de Circuitos y Dispositivos",
                    "Circuitos y Dispositivos",
                    "Electrónica",
                    "reglamento",
                    "Art. 17",
                    "Los alumnos tienen una tolerancia máxima de 15 minutos para ingresar a las prácticas de laboratorio. Pasado ese tiempo se considerará inasistencia.",
                ),
                (
                    "Reglamento del Laboratorio de Circuitos y Dispositivos",
                    "Circuitos y Dispositivos",
                    "Electrónica",
                    "reglamento",
                    "Art. 20",
                    "Queda terminantemente prohibido ingerir alimentos, bebidas y fumar dentro de las instalaciones del laboratorio. Quien infrinja será retirado del ambiente.",
                ),
                (
                    "Reglamento del Laboratorio de Circuitos y Dispositivos",
                    "Circuitos y Dispositivos",
                    "Electrónica",
                    "reglamento",
                    "Art. 28",
                    "El uso de horas libres para prácticas libres de estudiantes requiere: a) Dejar el carné universitario vigente. b) Las horas libres pueden cancelarse por razones académicas o de mantenimiento imprevisto. c) Registrar el uso en la hoja de Control de Uso de los Ambientes.",
                ),
                (
                    "Reglamento del Laboratorio de Circuitos y Dispositivos",
                    "Circuitos y Dispositivos",
                    "Electrónica",
                    "reglamento",
                    "Art. 31",
                    "Para solicitar componentes y equipos, el alumno debe presentar su carné universitario y llenar la ficha de requerimiento correspondiente ante el jefe de prácticas o encargado.",
                ),
                (
                    "Reglamento del Laboratorio de Sistemas Digitales",
                    "Sistemas Digitales",
                    "Electrónica",
                    "reglamento",
                    "Art. 17",
                    "La tolerancia de ingreso al laboratorio es de 10 minutos. Es obligatorio el uso de guardapolvo blanco.",
                ),
                (
                    "Reglamento del Laboratorio de Sistemas Digitales",
                    "Sistemas Digitales",
                    "Electrónica",
                    "reglamento",
                    "Art. 28",
                    "El préstamo de estaciones de trabajo y módulos FPGA durante horas libres se realiza previa reserva registrada y presentación del carné universitario.",
                ),
                (
                    "Reglamento Interno del Laboratorio de Telecomunicaciones",
                    "Telecomunicaciones",
                    "Electrónica",
                    "reglamento",
                    "Art. 12",
                    "El Laboratorio de Telecomunicaciones está reservado para sesiones de clase y proyectos de investigación asesorados. No contempla horas libres de reserva individual para estudiantes.",
                ),
                (
                    "Reglamento de Seguridad e Higiene Ocupacional del Laboratorio CIM",
                    "CIM",
                    "Industrial",
                    "seguridad",
                    "Art. 15",
                    "El ingreso a la celda de manufactura y robots solo está permitido con calzado de seguridad y previa autorización del docente responsable. Acceso restringido.",
                ),
                (
                    "Reglamento Interno y Protocolos de Seguridad del Taller de Metal Mecánica",
                    "Metal Mecánica",
                    "Industrial",
                    "seguridad",
                    "Art. 4",
                    "Es obligatorio el uso de Equipos de Protección Personal (EPP): lentes de policarbonato, botas con punta de acero, overol de trabajo y protección auditiva en zonas de mecanizado.",
                ),
                (
                    "Reglamento Interno y Protocolos de Seguridad del Taller de Metal Mecánica",
                    "Metal Mecánica",
                    "Industrial",
                    "seguridad",
                    "Art. 28",
                    "Los equipos y máquinas herramientas solo pueden ser operados bajo la supervisión directa del docente o técnico del taller. No se admiten reservas autónomas.",
                ),
            ]
            conn.executemany(
                "INSERT INTO reglamento_fragmentos (documento, laboratorio, escuela, tipo, referencia, texto) VALUES (?,?,?,?,?,?)",
                reglamentos,
            )

        conn.commit()
    print("Base SQLite lista (horarios reales; clases y equipos simulados)")


if __name__ == "__main__":
    inicializar_bd()
