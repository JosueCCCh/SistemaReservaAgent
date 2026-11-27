import { config } from '../../config/index.js';
import { ReglamentosService } from '../reglamentos/reglamentos.service.js';
import { DisponibilidadService } from '../disponibilidad/disponibilidad.service.js';
import { ReservasService } from '../reservas/reservas.service.js';
import { LaboratoriosService } from '../laboratorios/laboratorios.service.js';
import { db } from '../../db/index.js';
import { DIAS, validarFecha } from '../../utils/intervalos.js';

export class ChatService {
  private static systemInstruction = `
Eres un **Asistente de Laboratorios de la URP**. Ayudas a estudiantes con las normas de los laboratorios y con la reserva de horas libres.

**HERRAMIENTAS (tú decides cuándo usarlas):**
1. **buscar_reglamento (RAG):** reglamentos y manuales (normas, seguridad, procedimientos, préstamo de equipos, tolerancia de ingreso, recuperación de experimentos, circuitos impresos). Si el usuario menciona un laboratorio, pásalo en el parámetro laboratorio.
2. **listar_documentos:** documentos y laboratorios reales de la base.
3. **consultar_disponibilidad** y **consultar_calendario:** horas libres y reservas de un día.
4. **crear_reserva** y **cancelar_reserva:** registran o anulan una reserva de hora libre.

**REGLAS IMPORTANTES:**
- Nunca nombres un documento, laboratorio, artículo, hora o dato que no haya salido de una herramienta.
- Si no hay información, dilo honestamente.
- Siempre que uses el RAG cita documento y artículo. Ejemplo: "Según el Reglamento del Laboratorio de Circuitos y Dispositivos (Art. 17), la tolerancia de ingreso es de 15 minutos."
- Para preguntas de "qué documentos o laboratorios tienes", usa listar_documentos.
- Las reservas son solo de horas libres de estudiantes en Circuitos y Dispositivos y en Sistemas Digitales. Telecomunicaciones, CIM y Metal Mecánica son solo de consulta: explica con el reglamento y no crees reservas.
- Recuperación de experimentos y taller de circuitos impresos NO son reservas: explícalos con el reglamento (buscar_reglamento) y no crees reservas.
- Antes de pedir datos personales o intentar reservar, SIEMPRE verifica primero la disponibilidad con consultar_disponibilidad o consultar_calendario para la fecha y laboratorio solicitados. Si el horario ya está ocupado o ya existe una reserva activa para ese estudiante, avísale de inmediato y no le pidas datos en vano.
- Antes de crear_reserva necesitas laboratorio, fecha, hora de inicio, hora de fin, código, nombre y correo electrónico del estudiante. Si falta alguno y el horario sí está libre, pídelo amablemente; no inventes datos. NUNCA reserves automáticamente un horario sin que el usuario haya especificado la hora exacta o la haya confirmado.
- Si el usuario pregunta por disponibilidad o si hay otras horas libres, usa consultar_disponibilidad y enumera las horas libres disponibles; no reserves por tu cuenta.
- Fechas en AAAA-MM-DD y horas en HH:MM de 24 horas ("de 3 a 4 de la tarde" = 15:00 a 16:00).
- Si el usuario dice "Quiero reservar..." o insiste en un horario, debes llamar directamente a la herramienta crear_reserva con sus datos para validar y registrar la solicitud.
- El sistema valida las reglas de reserva. Si crear_reserva la rechaza porque el estudiante ya tiene esa reserva registrada (es_mi_reserva), infórmale claramente: "Ya tienes registrada la reserva n.º X para este mismo laboratorio y horario". Si la rechaza por otro motivo (ocupado por clase u otro usuario), explica la razón y propone las alternativas que devuelve. Nunca digas que una reserva fue creada si la herramienta no devolvió ok=true.
- Tras una reserva o cancelación exitosa, indica el número de reserva, los recordatorios del reglamento y confirma que el correo de confirmación oficial ha sido enviado a la dirección proporcionada.
- Sé claro, preciso, cálido y útil.
  `.trim();

  private static toolsDeclaration = [
    {
      functionDeclarations: [
        {
          name: "buscar_reglamento",
          description: "Busca en los reglamentos y manuales de los laboratorios de la URP (RAG) y devuelve fragmentos con su cita (documento y artículo).",
          parameters: {
            type: "OBJECT",
            properties: {
              consulta: { type: "STRING", description: "La pregunta o tema a buscar en español." },
              laboratorio: { type: "STRING", description: "Laboratorio específico (opcional): Circuitos, Sistemas Digitales, Telecomunicaciones, CIM o Metal Mecánica." }
            },
            required: ["consulta"]
          }
        },
        {
          name: "listar_documentos",
          description: "Devuelve los documentos y laboratorios reales que hay en la base de conocimiento.",
          parameters: {
            type: "OBJECT",
            properties: {}
          }
        },
        {
          name: "consultar_disponibilidad",
          description: "Devuelve las horas libres de un laboratorio en una fecha (formato AAAA-MM-DD).",
          parameters: {
            type: "OBJECT",
            properties: {
              laboratorio: { type: "STRING", description: "Nombre del laboratorio." },
              fecha: { type: "STRING", description: "Fecha en formato AAAA-MM-DD." }
            },
            required: ["laboratorio", "fecha"]
          }
        },
        {
          name: "consultar_calendario",
          description: "Lista las reservas activas de un laboratorio en un día específico (solo consulta).",
          parameters: {
            type: "OBJECT",
            properties: {
              laboratorio: { type: "STRING", description: "Nombre del laboratorio." },
              fecha: { type: "STRING", description: "Fecha en formato AAAA-MM-DD." }
            },
            required: ["laboratorio", "fecha"]
          }
        },
        {
          name: "crear_reserva",
          description: "Registra la reserva de una hora libre de estudiante en Circuitos y Dispositivos o Sistemas Digitales.",
          parameters: {
            type: "OBJECT",
            properties: {
              laboratorio: { type: "STRING", description: "Nombre del laboratorio." },
              fecha: { type: "STRING", description: "Fecha en formato AAAA-MM-DD." },
              hora_inicio: { type: "STRING", description: "Hora de inicio en formato HH:MM." },
              hora_fin: { type: "STRING", description: "Hora de fin en formato HH:MM." },
              codigo_estudiante: { type: "STRING", description: "Código universitario del estudiante." },
              nombre: { type: "STRING", description: "Nombre completo del estudiante." },
              correo: { type: "STRING", description: "Correo electrónico donde se enviará la confirmación." }
            },
            required: ["laboratorio", "fecha", "hora_inicio", "hora_fin", "codigo_estudiante", "nombre", "correo"]
          }
        },
        {
          name: "cancelar_reserva",
          description: "Anula una reserva activa mediante el número de reserva y el código del estudiante.",
          parameters: {
            type: "OBJECT",
            properties: {
              reserva_id: { type: "INTEGER", description: "ID o número de la reserva." },
              codigo_estudiante: { type: "STRING", description: "Código del estudiante que hizo la reserva." }
            },
            required: ["reserva_id", "codigo_estudiante"]
          }
        }
      ]
    }
  ];

  static async ejecutarTool(nombre: string, args: any): Promise<any> {
    console.log(`[AGENTE TOOL CALL] ${nombre}:`, JSON.stringify(args));
    try {
      switch (nombre) {
        case "buscar_reglamento":
          return ReglamentosService.buscarReglamentos(args.consulta, args.laboratorio);

        case "listar_documentos":
          return ReglamentosService.listarDocumentos();

        case "consultar_disponibilidad":
          return DisponibilidadService.calcularDisponibilidad(args.laboratorio, args.fecha);

        case "consultar_calendario": {
          const lab = LaboratoriosService.resolverLab(args.laboratorio);
          if (!lab) return { error: "Laboratorio no encontrado." };
          const reservas = db.prepare(`
            SELECT id AS reserva_id, hora_inicio, hora_fin, nombre AS estudiante 
            FROM reservas 
            WHERE laboratorio_id = ? AND fecha = ? AND estado = 'activa' 
            ORDER BY hora_inicio
          `).all(lab.id, args.fecha);
          return { laboratorio: lab.nombre, fecha: args.fecha, reservas };
        }

        case "crear_reserva":
          return await ReservasService.crearReserva(args);

        case "cancelar_reserva":
          return await ReservasService.cancelarReserva(Number(args.reserva_id), String(args.codigo_estudiante));

        default:
          return { error: `Herramienta desconocida: ${nombre}` };
      }
    } catch (err: any) {
      console.error(`Error ejecutando tool ${nombre}:`, err);
      return { error: err.message || "Error interno ejecutando la acción." };
    }
  }

  private static async llamarGeminiAPI(bodyObj: any): Promise<any> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || 'Error en llamada a Gemini API');
    }
    return data;
  }

  static async procesarMensaje(historial: { role: string; content: string }[], nuevoMensaje: string): Promise<string> {
    const ahora = new Date();
    const ahoraLimaStr = new Date(ahora.getTime() - 5 * 3600000).toISOString();
    const hoyFecha = ahoraLimaStr.substring(0, 10);
    const horaHHMM = ahoraLimaStr.substring(11, 16);
    const dt = validarFecha(hoyFecha);
    const utcDay = dt ? dt.getUTCDay() : 0;
    const diaNombre = DIAS[utcDay === 0 ? 6 : utcDay - 1];

    const contextHeader = `[Fecha y hora actual en Lima: ${diaNombre} ${hoyFecha} ${horaHHMM}]`;

    const contents: any[] = historial.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: `${contextHeader}\n${nuevoMensaje}` }]
    });

    let iteraciones = 0;
    while (iteraciones < 5) {
      iteraciones++;
      const payload = {
        system_instruction: { parts: [{ text: this.systemInstruction }] },
        tools: this.toolsDeclaration,
        contents
      };

      const response = await this.llamarGeminiAPI(payload);
      const candidate = response.candidates?.[0];
      if (!candidate) {
        return "Disculpa, no pude procesar tu mensaje en este momento.";
      }

      const parts = candidate.content?.parts || [];
      const functionCallPart = parts.find((p: any) => p.functionCall);

      if (!functionCallPart) {
        // Respuesta en texto regular
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text);
        return textParts.join('\n') || "¡Entendido!";
      }

      // Procesar llamada a herramienta
      const call = functionCallPart.functionCall;
      const toolResult = await this.ejecutarTool(call.name, call.args);

      // Enviar el part completo retornado por el modelo (incluyendo thought_signature si existe)
      contents.push({
        role: 'model',
        parts: [functionCallPart]
      });

      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: call.name,
            response: toolResult
          }
        }]
      });
    }

    return "He procesado tu consulta.";
  }
}
