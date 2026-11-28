import os
import sqlite3
from app.config import SQL_DB_PATH


def _conectar() -> sqlite3.Connection:
    db_dir = os.path.dirname(SQL_DB_PATH)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(SQL_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema(conn: sqlite3.Connection | None = None):
    own_conn = conn is None
    if own_conn:
        conn = _conectar()
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS laboratorios (
                id INTEGER PRIMARY KEY,
                nombre TEXT NOT NULL,
                escuela TEXT NOT NULL,
                permite_reserva INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS equipos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                laboratorio_id INTEGER NOT NULL REFERENCES laboratorios(id),
                codigo TEXT NOT NULL,
                nombre TEXT NOT NULL,
                estado TEXT NOT NULL DEFAULT 'operativo'
            );
            CREATE TABLE IF NOT EXISTS horario_atencion (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                laboratorio_id INTEGER NOT NULL REFERENCES laboratorios(id),
                dia_semana INTEGER NOT NULL,
                hora_inicio TEXT NOT NULL,
                hora_fin TEXT NOT NULL,
                refrigerio_inicio TEXT,
                refrigerio_fin TEXT
            );
            CREATE TABLE IF NOT EXISTS bloques_clase (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                laboratorio_id INTEGER NOT NULL REFERENCES laboratorios(id),
                dia_semana INTEGER NOT NULL,
                hora_inicio TEXT NOT NULL,
                hora_fin TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reservas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                laboratorio_id INTEGER NOT NULL REFERENCES laboratorios(id),
                fecha TEXT NOT NULL,
                hora_inicio TEXT NOT NULL,
                hora_fin TEXT NOT NULL,
                codigo_estudiante TEXT NOT NULL,
                nombre TEXT NOT NULL,
                correo TEXT NOT NULL,
                estado TEXT NOT NULL DEFAULT 'activa',
                creada_en TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS correos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reserva_id INTEGER REFERENCES reservas(id),
                tipo TEXT NOT NULL,
                destinatario TEXT NOT NULL,
                asunto TEXT NOT NULL,
                cuerpo TEXT NOT NULL,
                estado TEXT NOT NULL,
                creado_en TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reservas_equipo (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reserva_id INTEGER NOT NULL REFERENCES reservas(id),
                equipo_id INTEGER NOT NULL REFERENCES equipos(id),
                estado TEXT NOT NULL DEFAULT 'activa',
                creada_en TEXT NOT NULL
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS reglamento_fragmentos USING fts5(
                documento, laboratorio, escuela, tipo, referencia, texto
            );
            """
        )
        conn.commit()
    finally:
        if own_conn:
            conn.close()
