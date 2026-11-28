from datetime import datetime
import google.generativeai as genai
from app.config import API_KEY, GEMINI_MODEL, ZONA_HORARIA
from app.modules.disponibilidad.service import consultar_disponibilidad
from app.modules.reglamentos import service as reglamentos_service
from app.modules.reglamentos.service import RAGVectorStore, buscar_reglamento, listar_documentos
from app.modules.reservas.service import (
    cancelar_reserva,
    cancelar_reserva_equipo,
    consultar_calendario,
    consultar_equipos,
    crear_reserva,
    reservar_equipo,
)
from app.utils.intervalos import DIAS
from app.utils.tool_logger import LOG_TOOLS

if API_KEY:
    genai.configure(api_key=API_KEY)

TOOLS = [
    buscar_reglamento,
    listar_documentos,
    consultar_disponibilidad,
    crear_reserva,
    cancelar_reserva,
    consultar_calendario,
    consultar_equipos,
    reservar_equipo,
    cancelar_reserva_equipo,
]


class AgenteAcademico:
    def __init__(self, modelo: str = GEMINI_MODEL, temperatura: float = 0.3, rag_vector_store=None):
        """Inicializa el agente de laboratorios Gemini con function calling"""
        self.modelo = modelo
        self.temperatura = temperatura
        reglamentos_service.RAG_ACTIVO = rag_vector_store
        self.rag = rag_vector_store
        self.generation_config = {
            "temperature": temperatura,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 8192,
        }
        self.system_prompt = """
      Eres un **Asistente de Laboratorios de la URP**. Ayudas a estudiantes con las normas de los
      laboratorios y con la reserva de horas libres.

      **HERRAMIENTAS (tú decides cuándo usarlas):**
      1. **buscar_reglamento (RAG):** reglamentos y manuales (normas, seguridad, procedimientos,
         préstamo de equipos, recuperación de experimentos, circuitos impresos).
         Si el usuario menciona un laboratorio, pásalo en el parámetro laboratorio.
      2. **listar_documentos:** documentos y laboratorios reales de la base.
      3. **consultar_disponibilidad** y **consultar_calendario:** horas libres y reservas de un día.
      4. **crear_reserva** y **cancelar_reserva:** registran o anulan una reserva de hora libre.
      5. **consultar_equipos**, **reservar_equipo** y **cancelar_reserva_equipo:** cantidades, reserva y
          cancelación de equipos de Circuitos y Dispositivos y Sistemas Digitales.

      **REGLAS IMPORTANTES:**
      - Nunca nombres un documento, laboratorio, artículo, hora o dato que no haya salido de una herramienta.
      - Si no hay información, dilo honestamente.
      - Siempre que uses el RAG cita documento y artículo. Ejemplo:
        "Según el Reglamento del Laboratorio de Circuitos y Dispositivos (Art. 17), la tolerancia de ingreso es de 15 minutos."
      - Para preguntas de "qué documentos o laboratorios tienes", usa listar_documentos.
      - Las reservas son solo de horas libres de estudiantes en Circuitos y Dispositivos y en Sistemas Digitales.
        Telecomunicaciones, CIM y Metal Mecánica son solo de consulta: explica con el reglamento y no crees reservas.
      - Recuperación de experimentos y taller de circuitos impresos NO son reservas:
        explícalos con el reglamento (buscar_reglamento) y no crees reservas.
      - Antes de crear_reserva necesitas laboratorio, fecha, hora de inicio, hora de fin, código, nombre y correo electrónico del estudiante.
        Si falta alguno, pídelo; no inventes datos del estudiante.
      - Fechas en AAAA-MM-DD y horas en HH:MM de 24 horas ("de 3 a 4 de la tarde" = 15:00 a 16:00).
        Calcula "mañana" o "el lunes" con la fecha actual que aparece al inicio de cada mensaje.
      - El sistema valida las reglas de reserva. Si crear_reserva la rechaza, explica el motivo y propone las alternativas
        que devuelve. Nunca digas que una reserva fue creada si la herramienta no devolvió ok.
      - Tras una reserva o cancelación exitosa, indica el número de reserva y los recordatorios que devolvió la herramienta.
        El sistema envía el correo solo. Según correo_estado: "enviado" = di que le enviaste el correo a correo_destinatario;
        "simulado" = di que se generó un correo de confirmación de prueba (no se envió);
        si empieza con "error" = di que la reserva quedó registrada pero el correo no pudo enviarse.
        Nunca digas que enviaste un correo si correo_estado no es "enviado".
      - Para preguntas de cuántos equipos hay, cuáles están en mantenimiento o cuántos están libres en un horario, usa consultar_equipos. Nunca inventes equipos, cantidades ni códigos.
      - Los equipos se reservan sobre una reserva de hora libre (mismo laboratorio, fecha y horario). Si el estudiante aún no la tiene,
        primero crea la reserva (pidiendo los datos que falten) y luego reserva el equipo con su número de reserva.
      - Si reservar_equipo rechaza (poca cantidad, mantenimiento, varios tipos que coinciden), explica el motivo y ofrece alternativas.
        Nunca digas que un equipo fue reservado si la herramienta no devolvió ok.
      - Para quitar equipos usa cancelar_reserva_equipo con el número de la reserva; si pide quitar "un" equipo y tiene varios del mismo tipo, usa cantidad=1.
        Lo del correo_estado también aplica a reservar_equipo y cancelar_reserva_equipo.
      - Recuerdas toda la conversación (nombre del usuario, preguntas anteriores).
      - Si reservar_equipo devuelve "opciones", NO elijas tú: pregúntale al estudiante cuál quiere y reserva solo cuando responda.
      - Sé claro, preciso, cálido y útil.
      """
        self.model = genai.GenerativeModel(
            model_name=self.modelo,
            generation_config=self.generation_config,
            system_instruction=self.system_prompt,
            tools=TOOLS,
        )
        self.chat_session = self.model.start_chat(history=[], enable_automatic_function_calling=True)
        self.historial_guardado: list[dict] = []

    def enviar_mensaje(self, mensaje: str, chat_session=None) -> str:
        """Envía un mensaje al agente y mantiene la memoria de la conversación"""
        session = chat_session or self.chat_session
        try:
            LOG_TOOLS.clear()
            ahora = datetime.now(ZONA_HORARIA)
            fecha_actual = f"[Fecha y hora actual en Lima: {DIAS[ahora.weekday()]} {ahora.strftime('%Y-%m-%d %H:%M')}]"
            response = session.send_message(
                f"{fecha_actual}\n{mensaje}",
                request_options={"timeout": 30},
            )
            texto = response.text or "No pude generar una respuesta."
            self.historial_guardado.append(
                {
                    "timestamp": datetime.now().isoformat(),
                    "user": mensaje,
                    "assistant": texto,
                    "tools_usadas": list(LOG_TOOLS),
                }
            )
            return texto
        except Exception as e:
            print(f"Error al enviar el mensaje: {type(e).__name__}: {e}")
            return "Lo siento, ocurrió un error o el sistema tardó demasiado en responder. Por favor, intenta de nuevo."

    def procesar_mensaje(self, historial: list[dict], nuevo_mensaje: str) -> str:
        """Procesa un mensaje con historial explícito (para el endpoint REST /api/chat)"""
        gemini_history = [
            {
                "role": "model" if m.get("role") == "assistant" else "user",
                "parts": [m.get("content", "")],
            }
            for m in historial
            if m.get("content")
        ]
        session = self.model.start_chat(
            history=gemini_history, enable_automatic_function_calling=True
        )
        return self.enviar_mensaje(nuevo_mensaje, chat_session=session)

    def reset(self):
        """Reiniciar la memoria a cero"""
        self.chat_session = self.model.start_chat(history=[], enable_automatic_function_calling=True)
        self.historial_guardado = []
        print("Conversación reiniciada")

    def mostrar_historial(self):
        """Muestra el historial de la conversación"""
        print("===Historial===")
        for msg in self.chat_session.history:
            rol = "Tu:" if msg.role == "user" else "chatbot"
            contenido = " ".join(p.text for p in msg.parts if getattr(p, "text", "")) if msg.parts else ""
            if contenido:
                print(f"\n[{rol}]\n{contenido}")


_vector_store = RAGVectorStore()
_agente_instancia: AgenteAcademico | None = None


def obtener_agente() -> AgenteAcademico:
    global _agente_instancia
    if _agente_instancia is None:
        _agente_instancia = AgenteAcademico(rag_vector_store=_vector_store)
    return _agente_instancia
