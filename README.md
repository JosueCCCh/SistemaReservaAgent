# 🎓 Sistema de Reserva de Laboratorios URP + Agente IA & RAG

Sistema web integral y moderno para la gestión y reserva de horas libres en los laboratorios de la **Universidad Ricardo Palma (URP)**, integrado con un **Agente Inteligente (Google Gemini)** dotado de **Function Calling** y un motor **RAG (Retrieval-Augmented Generation)** para consulta de reglamentos universitarios y normativas de seguridad.

---

## 🚀 Características Principales

- **Dashboard Web Moderno y Responsivo:** Construido con **React 18, TypeScript y Vite**. Sin necesidad de login; la identidad se valida mediante el código universitario del estudiante.
- **Motor de Disponibilidad en Tiempo Real:** 
  $$\text{Horas Libres} = \text{Horario Atención} - (\text{Refrigerios} \cup \text{Clases Ocupadas} \cup \text{Reservas Activas})$$
  Filtra automáticamente horas y fechas pasadas en zona horaria `America/Lima` (UTC-5).
- **Asistente IA con Function Calling (Gemini):** Chatbot interactivo capaz de consultar disponibilidad, registrar y cancelar reservas, y buscar artículos de reglamento de forma conversacional.
- **RAG de Reglamentos y Manuales:** Búsqueda textual y semántica con citas normativas precisas (*Documento + Artículo*).
- **Notificaciones Automáticas por Correo:** Integración con **Nodemailer (Gmail SMTP)** para el envío de confirmaciones y cancelaciones con recordatorios de los Artículos 20 y 28 de la URP.
- **Control de Concurrencia Transaccional:** Base de datos **SQLite (WAL mode)** que previene colisiones y dobles reservas simultáneas.

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
│           Backend Node.js + Express          │
│  (Rutas REST, Servicios de Negocio, Zod)     │
└───────┬──────────────┬──────────────┬────────┘
        │              │              │
 ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐
 │   SQLite    │ │ Gemini API │ │   Nodemailer   │
 │ (FTS5 + DB) │ │ (Agent IA) │ │ (Gmail SMTP)   │
 └─────────────┘ └────────────┘ └────────────────┘
```

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 18, TypeScript, Vite, Lucide Icons.
- **Backend:** Node.js, Express, TypeScript, Better-SQLite3, Zod.
- **Inteligencia Artificial:** Google Generative AI SDK (`gemini-3.5-flash-lite`) con Function Calling.
- **Correos:** Nodemailer con autenticación de aplicación Gmail.
- **Testing:** Vitest con pruebas unitarias y de integración.

---

## 📋 Requisitos Previos

- [Node.js](https://nodejs.org/) (versión 18 o superior).
- Cuenta y API Key de [Google AI Studio](https://aistudio.google.com/).
- Cuenta de Gmail con contraseña de aplicación habilitada (opcional para correos reales).

---

## ⚙️ Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/JosueCCCh/SistemaReservaAgent.git
cd SistemaReservaAgent
```

### 2. Configurar variables de entorno del servidor
Crea el archivo `.env` dentro de la carpeta `server/` basándote en `.env.example`:

```bash
cd server
cp .env.example .env
```

Edita `server/.env` con tus credenciales:
```env
PORT=3000
DB_PATH=./data/reservas.db
TZ=America/Lima

# Notificaciones por Correo
MAIL_MODE=real               # 'real' para enviar Gmails o 'simulado' para pruebas locales
MAIL_FROM=tu_correo@gmail.com
MAIL_APP_PASSWORD=tu_clave_de_aplicacion_google
ALLOWED_EMAIL_DOMAINS=

# Agente IA Gemini
GEMINI_API_KEY=tu_api_key_de_gemini
GEMINI_MODEL=gemini-3.5-flash-lite
```

### 3. Instalar dependencias
```bash
# En la carpeta server
cd server
npm install

# En la carpeta client
cd ../client
npm install
```

### 4. Inicializar y poblar la Base de Datos
```bash
cd ../server
npm run db:seed
```

---

## ▶️ Ejecución del Proyecto

### Iniciar el Servidor Backend:
```bash
cd server
npm run dev
```
> El servidor API iniciará en `http://localhost:3000`.

### Iniciar el Frontend Dashboard:
En otra terminal:
```bash
cd client
npm run dev
```
> Abre tu navegador en `http://localhost:5173`.

---

## 🧪 Pruebas Unitarias e Integración

El proyecto incluye una suite de pruebas automatizadas con **Vitest**:
```bash
cd server
npm test
```

---

## 📜 Reglas de Dominio de la URP

- **Laboratorios reservables para horas libres:** *Circuitos y Dispositivos* y *Sistemas Digitales*.
- **Laboratorios de solo consulta:** *Telecomunicaciones*, *CIM* y *Metal Mecánica*.
- **Cancelaciones:** Solo pueden ser realizadas por el alumno titular ingresando su código universitario registrado.
- **Normativa visible:** Se citan los recordatorios del carné universitario vigente (Art. 28 a), hoja de control (Art. 28 c) y prohibición de alimentos/bebidas (Art. 20).

---

## 👤 Autor

- **Josué Córdova** - [GitHub](https://github.com/JosueCCCh)
