import { db } from '../../db/index.js';
import { 
  aMin, 
  aHHMM, 
  validarHora, 
  validarFecha, 
  chocaIntervalos, 
  restarIntervalos, 
  formatearIntervalos,
  normalizar 
} from '../../utils/intervalos.js';
import { config } from '../../config/index.js';
import { LaboratoriosService } from '../laboratorios/laboratorios.service.js';
import { DisponibilidadService } from '../disponibilidad/disponibilidad.service.js';
import { NotificacionesService } from '../notificaciones/notificaciones.service.js';
import { Reserva } from '../../../../shared/types.js';

export interface CrearReservaParams {
  laboratorio: string | number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  codigo_estudiante: string;
  nombre: string;
  correo: string;
}

export class ReservasService {
  static validarCorreo(correo: string): boolean {
    const regex = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
    if (!regex.test(correo)) return false;
    if (config.mail.allowedDomains.length > 0) {
      const dominio = correo.split('@')[1]?.toLowerCase();
      return config.mail.allowedDomains.includes(dominio);
    }
    return true;
  }

  static async crearReserva(params: CrearReservaParams) {
    const { laboratorio, fecha, hora_inicio, hora_fin, codigo_estudiante, nombre, correo } = params;

    const dt = validarFecha(fecha);
    const ini = validarHora(hora_inicio);
    const fin = validarHora(hora_fin);

    if (!dt || ini === null || fin === null) {
      return { ok: false, motivo: "Fecha u hora inválida. Usa AAAA-MM-DD y HH:MM (24 horas)." };
    }

    if (fin <= ini) {
      return { ok: false, motivo: "La hora de fin debe ser posterior a la de inicio." };
    }

    if (!codigo_estudiante?.trim() || !nombre?.trim()) {
      return { ok: false, motivo: "Faltan el código y el nombre del estudiante." };
    }

    const emailTrimmed = correo?.trim().toLowerCase() || '';
    if (!this.validarCorreo(emailTrimmed)) {
      return { ok: false, motivo: "Falta un correo electrónico válido del estudiante (o su dominio no está permitido)." };
    }

    // Comprobar fecha y hora en el pasado (zona horaria Lima)
    const ahora = new Date();
    // Conversión aproximada para timezone Lima (UTC-5)
    const ahoraLimaStr = new Date(ahora.getTime() - 5 * 3600000).toISOString();
    const hoyLimaFecha = ahoraLimaStr.substring(0, 10);
    const hoyLimaMinutos = parseInt(ahoraLimaStr.substring(11, 13)) * 60 + parseInt(ahoraLimaStr.substring(14, 16));

    if (fecha < hoyLimaFecha || (fecha === hoyLimaFecha && ini < hoyLimaMinutos)) {
      return { ok: false, motivo: "No se puede reservar en una fecha u hora que ya pasó." };
    }

    const lab = typeof laboratorio === 'number'
      ? LaboratoriosService.obtenerPorId(laboratorio)
      : LaboratoriosService.resolverLab(laboratorio);

    if (!lab) {
      const labs = LaboratoriosService.listarTodos().map(l => l.nombre);
      return { ok: false, motivo: "No reconozco ese laboratorio.", laboratorios_validos: labs };
    }

    if (!lab.permite_reserva) {
      return { ok: false, motivo: `${lab.nombre} no contempla reservas de horas libres; solo se puede consultar su reglamento y manual.` };
    }

    // Transacción para garantizar consistencia atómica y evitar doble reserva
    const tx = db.transaction(() => {
      const { atencion, refrigerios, clases, reservas } = DisponibilidadService.obtenerDatosDelDia(lab.id, fecha);
      const bloqueados = [...refrigerios, ...clases, ...reservas];
      let libres = restarIntervalos(atencion, bloqueados);

      // Si la reserva rechazada es de hoy, sugerir solo las franjas que aún no pasaron
      if (fecha === hoyLimaFecha) {
        libres = libres.filter(([_, bFin]) => bFin > hoyLimaMinutos);
      }

      // Comprobar si el bloque solicitado encaja en alguna franja libre
      const encaja = libres.some(([a, b]) => a <= ini && fin <= b);
      if (!encaja) {
        const motivos: string[] = [];
        if (!atencion.some(([a, b]) => a <= ini && fin <= b)) motivos.push("está fuera del horario de atención");
        if (chocaIntervalos(ini, fin, refrigerios)) motivos.push("coincide con el refrigerio del personal");
        if (chocaIntervalos(ini, fin, clases)) motivos.push("hay clase en ese horario");
        if (chocaIntervalos(ini, fin, reservas)) motivos.push("ya hay una reserva activa en ese horario");
        if (motivos.length === 0) motivos.push("no está completamente libre");

        return {
          ok: false,
          motivo: `Ese horario ${motivos.join(' y ')}.`,
          horas_libres_ese_dia: formatearIntervalos(libres)
        };
      }

      const stmt = db.prepare(`
        INSERT INTO reservas (laboratorio_id, fecha, hora_inicio, hora_fin, codigo_estudiante, nombre, correo, estado, creada_en)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'activa', ?)
      `);
      const info = stmt.run(lab.id, fecha, aHHMM(ini), aHHMM(fin), codigo_estudiante.trim(), nombre.trim(), emailTrimmed, ahoraLimaStr);

      return {
        ok: true,
        reservaId: info.lastInsertRowid as number,
        labNombre: lab.nombre
      };
    });

    const resultado = tx();
    if (!resultado.ok) return resultado;

    // Enviar correo de confirmación
    const envio = await NotificacionesService.enviarCorreo(resultado.reservaId!, 'confirmacion');

    return {
      ok: true,
      reserva_id: resultado.reservaId,
      laboratorio: resultado.labNombre,
      fecha,
      hora_inicio: aHHMM(ini),
      hora_fin: aHHMM(fin),
      estudiante: nombre.trim(),
      correo_destinatario: envio.destinatario,
      correo_estado: envio.estado,
      recordatorios: [
        "Dejar el carné universitario vigente (Art. 28 a).",
        "Registrar el uso en la hoja de Control de Uso de los Ambientes (Horas Libres) (Art. 28 c).",
        "La hora libre puede cancelarse por razones académicas o de mantenimiento (Art. 28 b).",
        "Prohibido ingresar alimentos y bebidas, y fumar (Art. 20)."
      ]
    };
  }

  static async cancelarReserva(reservaId: number, codigoEstudiante: string) {
    const reserva = db.prepare(`
      SELECT r.*, l.nombre AS lab 
      FROM reservas r 
      JOIN laboratorios l ON l.id = r.laboratorio_id 
      WHERE r.id = ?
    `).get(reservaId) as any;

    if (!reserva) {
      return { ok: false, motivo: "No existe una reserva con ese número." };
    }

    if (normalizar(reserva.codigo_estudiante) !== normalizar(codigoEstudiante)) {
      return { 
        ok: false, 
        motivo: "El código no coincide con el de la reserva. Por seguridad, solo quien reservó puede cancelarla." 
      };
    }

    if (reserva.estado !== 'activa') {
      return { ok: false, motivo: "Esa reserva ya estaba cancelada." };
    }

    db.prepare("UPDATE reservas SET estado = 'cancelada' WHERE id = ?").run(reservaId);

    // Enviar correo de cancelación
    const envio = await NotificacionesService.enviarCorreo(reservaId, 'cancelacion');

    return {
      ok: true,
      reserva_id: reserva.id,
      laboratorio: reserva.lab,
      fecha: reserva.fecha,
      hora_inicio: reserva.hora_inicio,
      hora_fin: reserva.hora_fin,
      correo_destinatario: envio.destinatario,
      correo_estado: envio.estado
    };
  }

  static listarReservas(filtros: { laboratorioId?: number; fecha?: string; codigoEstudiante?: string }) {
    let sql = `
      SELECT r.*, l.nombre AS laboratorio_nombre 
      FROM reservas r
      JOIN laboratorios l ON l.id = r.laboratorio_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filtros.laboratorioId) {
      sql += ' AND r.laboratorio_id = ?';
      params.push(filtros.laboratorioId);
    }
    if (filtros.fecha) {
      sql += ' AND r.fecha = ?';
      params.push(filtros.fecha);
    }
    if (filtros.codigoEstudiante) {
      sql += ' AND r.codigo_estudiante = ?';
      params.push(filtros.codigoEstudiante.trim());
    }

    sql += ' ORDER BY r.fecha DESC, r.hora_inicio ASC';
    return db.prepare(sql).all(...params) as Reserva[];
  }
}
