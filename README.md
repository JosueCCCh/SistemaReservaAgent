# 🎓 Sistema de Reserva de Laboratorios URP + Agente IA & RAG

Sistema web integral para la gestión y reserva de horas libres en los laboratorios de la **Universidad Ricardo Palma (URP)**, integrado con un **Agente Inteligente (Google Gemini)** dotado de **Function Calling** y un motor **RAG (Retrieval-Augmented Generation)** para consulta de reglamentos y normativas de seguridad.

---

## 🚀 Características Principales

- **Dashboard Web Moderno y Responsivo:** Construido con **React 18, TypeScript y Vite**. Sin necesidad de login; la identidad se valida mediante el código universitario del estudiante.
- **Motor de Disponibilidad en Tiempo Real:**
  $$\text{Horas Libres} = \text{Horario Atención} - (\text{Refrigerios} \cup \text{Clases Ocupadas} \cup \text{Reservas Activas})$$
  Filtra automáticamente horas y fechas pasadas en zona horaria `America/Lima` (UTC-5).
- **Asistente IA con Function Calling (Gemini):** Chatbot interactivo con 9 tools distribuidas en sus módulos de dominio — disponibilidad, reservas, equipos y reglamentos — con soporte de historial de conversación.
- **RAG de Reglamentos y Manuales:** Búsqueda semántica con ChromaDB (si está disponible) o de respaldo con SQLite FTS5, con citas normativas precisas (*Documento + Artículo*).
- **Notificaciones Automáticas por Correo:** Integración con **smtplib + Gmail SMTP** para el envío de confirmaciones, cancelaciones y actualizaciones de equipos con recordatorios de los artículos relevantes del reglamento URP.
- **Control de Concurrencia:** Base de datos **SQLite (WAL mode)** que previene colisiones y dobles reservas simultáneas.
- **Renderizado Markdown en el Chat:** Los mensajes del asistente se renderizan con `react-markdown` y `@tailwindcss/typography` para mostrar negritas, listas y formato correctamente.

---

## 🏗️ Arquitectura del Sistema

```
┌──────────────────────────────────────────────┐
│           Dashboard Web (React + TS)         │
│  [Inicio] [Laboratorios] [Reservar] [RAG]    │
│             [+ Chatbot IA Flotante]          │
└──────────────────────┬───────────────────────┘
                       │ HTTP / JSON
                       ▼
┌──────────────────────────────────────────────┐
│          Backend Python + FastAPI            │
│  (Rutas REST, Servicios de Negocio, Pydantic)│
└───────┬──────────────┬──────────────┬────────┘
        │              │              │
 ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐
 │   SQLite    │ │ Gemini API │ │  smtplib/Gmail  │
 │ (FTS5 + DB) │ │ (Agent IA) │ │  (SMTP SSL)    │
 └─────────────┘ └────────────┘ └────────────────┘
         │
  ┌──────▼──────┐
  │  ChromaDB   │  (opcional: RAG semántico)
  └─────────────┘
```

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, `react-markdown`, `@tailwindcss/typography`, Lucide Icons.
- **Backend:** Python 3.11+, FastAPI, Uvicorn, SQLite3 (WAL + FTS5), Pydantic v2.
- **Inteligencia Artificial:** `google-generativeai` SDK con `gemini-3.5-flash-lite` y Function Calling con automatic function calling habilitado.
- **RAG:** ChromaDB (semántico) con respaldo automático a SQLite FTS5.
- **Correos:** `smtplib` con autenticación de aplicación Gmail (SMTP SSL port 465).
- **Testing:** `pytest` con `httpx` y `fastapi.testclient`.

---

## 📁 Estructura del Proyecto

```
SistemaReservaAgent/
├── client/                         # Frontend React + Vite
│   ├── src/
│   │   ├── api/client.ts           # Funciones fetch a la API REST
│   │   └── components/ChatWidget.tsx  # Chatbot IA con react-markdown
│   ├── tailwind.config.js
│   └── package.json
│
└── server/                         # Backend Python + FastAPI
    ├── app/
    │   ├── config.py               # Variables de entorno (.env)
    │   ├── main.py                 # Entrypoint FastAPI + CORS + lifespan
    │   ├── db/
    │   │   ├── database.py         # _conectar(), init_schema()
    │   │   └── seed.py             # inicializar_bd() con datos reales
    │   ├── utils/
    │   │   ├── intervalos.py       # Helpers de tiempo e intervalos
    │   │   └── tool_logger.py      # LOG_TOOLS compartido entre módulos
    │   ├── modules/
    │   │   ├── laboratorios/service.py
    │   │   ├── disponibilidad/service.py   # + tool consultar_disponibilidad
    │   │   ├── notificaciones/service.py   # _enviar_correo (simulado/real)
    │   │   ├── reservas/service.py         # + tools crear/cancelar/equipos
    │   │   ├── reglamentos/service.py      # + tools buscar/listar + RAGVectorStore
    │   │   └── chat/agent.py               # AgenteAcademico + TOOLS list
    │   └── routes/api.py           # Endpoints FastAPI /api/*
    ├── tests/test_sistema.py       # Suite pytest (5 tests)
    ├── requirements.txt
    └── .env
```

---

## 📋 Requisitos Previos

- **Python 3.11+**
- **Node.js 18+** (para el frontend)
- Cuenta y API Key de [Google AI Studio](https://aistudio.google.com/)
- Cuenta de Gmail con contraseña de aplicación habilitada (opcional, para correos reales)
- *(Opcional)* Base de datos ChromaDB con la colección `reglamentos_labs` para RAG semántico

---

## ⚙️ Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/JosueCCCh/SistemaReservaAgent.git
cd SistemaReservaAgent
```

### 2. Configurar variables de entorno del servidor
El archivo `server/.env` ya incluye valores por defecto. Edítalo con tus credenciales:

```env
PORT=3000
DB_PATH=./data/reservas.db
TZ=America/Lima

# Notificaciones por Correo
MAIL_MODE=simulado           # 'real' para enviar Gmails | 'simulado' para pruebas locales
MAIL_FROM=tu_correo@gmail.com
MAIL_APP_PASSWORD=tu_clave_de_aplicacion_google
ALLOWED_EMAIL_DOMAINS=       # vacío = cualquier dominio; ej: urp.edu.pe

# Agente IA Gemini
GEMINI_API_KEY=tu_api_key_de_gemini
GEMINI_MODEL=gemini-3.5-flash-lite

# RAG ChromaDB (opcional)
RAG_DB_PATH=./data/chroma_db
COLLECTION_NAME=reglamentos_labs
```

### 3. Instalar dependencias del backend (Python)
```bash
cd server
pip install -r requirements.txt
```

### 4. Instalar dependencias del frontend
```bash
cd ../client
npm install
```

---

## ▶️ Ejecución del Proyecto

### Iniciar el servidor backend:
```bash
cd server
python -m uvicorn app.main:app --reload --port 3000
```
> La API iniciará en `http://localhost:3000`. La base de datos se inicializa automáticamente al arrancar si está vacía.

### Iniciar el frontend:
En otra terminal:
```bash
cd client
npm run dev
```
> Abre tu navegador en `http://localhost:5173`.

### Scripts del `package.json` raíz:
```bash
npm run dev:server   # Inicia el backend FastAPI en puerto 3000
npm run dev:client   # Inicia el frontend Vite en puerto 5173
npm run seed         # Fuerza la reinicialización de la base de datos
npm run test:server  # Ejecuta la suite pytest
```

---

## 🧪 Pruebas

El proyecto incluye una suite de pruebas con **pytest** que cubre:

```bash
cd server
python -m pytest -v
```

| Test | Descripción |
|---|---|
| `test_disponibilidad_circuitos` | Calcula horas libres correctamente para un lunes |
| `test_buscar_reglamento_rag` | Encuentra Art. 17 con la cita exacta |
| `test_crear_y_duplicar_y_equipos_y_cancelar_reserva` | Flujo completo: crear → duplicado → equipos → cancelar |
| `test_telecomunicaciones_sin_reservas` | Rechaza reservas en labs sin horas libres |
| `test_fastapi_endpoints` | Verifica `/health`, `/api/laboratorios`, `/api/equipos`, `/api/reglamentos/documentos` |

---

## 🤖 Tools del Agente IA

Las 9 herramientas están distribuidas en sus módulos de dominio y se pasan a Gemini vía `enable_automatic_function_calling=True`:

| Tool | Módulo | Descripción |
|---|---|---|
| `buscar_reglamento` | `reglamentos/` | Busca en ChromaDB o FTS5 con cita de artículo |
| `listar_documentos` | `reglamentos/` | Lista documentos y laboratorios de la base |
| `consultar_disponibilidad` | `disponibilidad/` | Horas libres de un laboratorio en una fecha |
| `crear_reserva` | `reservas/` | Registra la reserva y envía correo de confirmación |
| `cancelar_reserva` | `reservas/` | Anula la reserva y envía correo de cancelación |
| `consultar_calendario` | `reservas/` | Lista reservas activas de un día con sus equipos |
| `consultar_equipos` | `reservas/` | Inventario y disponibilidad de equipos por horario |
| `reservar_equipo` | `reservas/` | Agrega equipos a una reserva existente |
| `cancelar_reserva_equipo` | `reservas/` | Quita equipos de una reserva |

---

## 📜 Reglas de Dominio de la URP

- **Laboratorios reservables para horas libres:** *Circuitos y Dispositivos* y *Sistemas Digitales*.
- **Laboratorios de solo consulta:** *Telecomunicaciones*, *CIM* y *Metal Mecánica*.
- **Cancelaciones:** Solo puede cancelar el alumno titular usando su código universitario registrado.
- **Normativa aplicada:** Art. 17 (tolerancia de ingreso), Art. 20 (prohibición de alimentos/bebidas/fumar), Art. 28 (uso de horas libres y control de ambientes), Art. 31 (préstamo de equipos).

---

## 👥 Autores

- **Josué Córdova** - [GitHub](https://github.com/JosueCCCh)
- **Rogelio Minaya** - [GitHub](https://github.com/rogeliominaya21)
