import os
from pathlib import Path
from zoneinfo import ZoneInfo
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

PORT = int(os.getenv("PORT", "3000"))

_raw_db_path = os.getenv("DB_PATH", "./data/reservas.db")
SQL_DB_PATH = str((BASE_DIR / _raw_db_path).resolve()) if not os.path.isabs(_raw_db_path) else _raw_db_path

TZ_NAME = os.getenv("TZ", "America/Lima")
ZONA_HORARIA = ZoneInfo(TZ_NAME)

# Correo de confirmación de reservas (igual que en Agente_IA_labs_urp.ipynb)
_mail_mode = os.getenv("MAIL_MODE", "simulado").strip().lower()
ENVIO_REAL = _mail_mode == "real"
CORREO_REMITENTE = os.getenv("MAIL_FROM", os.getenv("EMAIL_USER", ""))
CORREO_CLAVE_APP = os.getenv("MAIL_APP_PASSWORD", os.getenv("EMAIL_PASS", "")).replace(" ", "")
_raw_domains = os.getenv("ALLOWED_EMAIL_DOMAINS", "")
DOMINIOS_PERMITIDOS = [d.strip().lower() for d in _raw_domains.split(",") if d.strip()]

# Agente IA (Gemini API)
API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

# RAG (ChromaDB opcional; si no existe, se usa SQLite FTS5)
RAG_DB_PATH = os.getenv("RAG_DB_PATH", str(BASE_DIR / "data" / "chroma_db"))
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "reglamentos_labs")

# Email transaccional vía Brevo HTTP API (alternativa a SMTP bloqueado en Render Free)
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "")
