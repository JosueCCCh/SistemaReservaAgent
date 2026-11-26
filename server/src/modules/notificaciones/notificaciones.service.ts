import nodemailer from 'nodemailer';
import { db } from '../../db/index.js';
import { config } from '../../config/index.js';

export class NotificacionesService {
  private static transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.mail.from,
      pass: config.mail.appPassword.replace(/\s+/g, '')
    }
  });

  static async enviarCorreo(reservaId: number, tipo: 'confirmacion' | 'cancelacion'): Promise<{ destinatario: string; estado: string }> {
    const reserva = db.prepare(`
      SELECT r.*, l.nombre AS lab 
      FROM reservas r 
      JOIN laboratorios l ON l.id = r.laboratorio_id 
      WHERE r.id = ?
    `).get(reservaId) as any;

    if (!reserva || !reserva.correo) {
      return { destinatario: '', estado: 'sin_correo' };
    }

    const destino = reserva.correo;
    const detalle = `
  • Laboratorio: ${reserva.lab}
  • Fecha: ${reserva.fecha}
  • Horario: ${reserva.hora_inicio} a ${reserva.hora_fin}
  • Número de reserva: ${reserva.id}
    `.trim();

    let asunto = '';
    let cuerpo = '';

    if (tipo === 'confirmacion') {
      asunto = `Confirmación de reserva n.º ${reserva.id} - ${reserva.lab}`;
      cuerpo = `¡Hola, ${reserva.nombre}!

Tu reserva de hora libre ha sido registrada exitosamente.
${detalle}

Recordatorios importantes:
  • Dejar el carné universitario vigente (Art. 28 a).
  • Registrar el uso en la hoja de Control de Uso de los Ambientes (Horas Libres) (Art. 28 c).
  • La hora libre puede cancelarse por razones académicas o de mantenimiento (Art. 28 b).
  • Prohibido ingresar alimentos y bebidas, y fumar (Art. 20).

Para cancelarla, puedes hacerlo desde el sistema con tu código de estudiante (${reserva.codigo_estudiante}).

Atentamente,
Asistente de Laboratorios URP
`;
    } else {
      asunto = `Cancelación de reserva n.º ${reserva.id} - ${reserva.lab}`;
      cuerpo = `Hola, ${reserva.nombre}:

Tu reserva ha sido cancelada:
${detalle}

El horario ha quedado libre nuevamente. Si lo requieres, puedes realizar una nueva reserva en el sistema.

Atentamente,
Asistente de Laboratorios URP
`;
    }

    let estado: string = 'simulado';

    if (config.mail.mode === 'real') {
      try {
        await this.transporter.sendMail({
          from: config.mail.from,
          to: destino,
          subject: asunto,
          text: cuerpo
        });
        estado = 'enviado';
      } catch (err: any) {
        console.error('Error enviando correo real:', err);
        estado = `error: ${err.message || 'SMTP_FAILED'}`;
      }
    }

    const ahora = new Date().toISOString();
    db.prepare(`
      INSERT INTO correos (reserva_id, tipo, destinatario, asunto, cuerpo, estado, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(reservaId, tipo, destino, asunto, cuerpo, estado, ahora);

    console.log(`[CORREO ${estado.toUpperCase()}] a ${destino} | ${asunto}`);
    return { destinatario: destino, estado };
  }
}
