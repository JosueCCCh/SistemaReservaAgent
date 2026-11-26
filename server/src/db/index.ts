import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema() {
  db.exec(`
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
      dia_semana INTEGER NOT NULL,          -- 0 = lunes ... 6 = domingo
      hora_inicio TEXT NOT NULL,            -- HH:MM
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
      fecha TEXT NOT NULL,                  -- YYYY-MM-DD
      hora_inicio TEXT NOT NULL,            -- HH:MM
      hora_fin TEXT NOT NULL,
      codigo_estudiante TEXT NOT NULL,
      nombre TEXT NOT NULL,
      correo TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'activa', -- activa | cancelada
      creada_en TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS correos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reserva_id INTEGER REFERENCES reservas(id),
      tipo TEXT NOT NULL,                   -- confirmacion | cancelacion
      destinatario TEXT NOT NULL,
      asunto TEXT NOT NULL,
      cuerpo TEXT NOT NULL,
      estado TEXT NOT NULL,                 -- enviado | simulado | error
      creado_en TEXT NOT NULL
    );

    -- Tabla virtual FTS5 para el RAG de reglamentos y manuales
    CREATE VIRTUAL TABLE IF NOT EXISTS reglamento_fragmentos USING fts5(
      documento, laboratorio, escuela, tipo, referencia, texto
    );
  `);
}
