import { db } from '../../db/index.js';
import { 
  aMin, 
  validarFecha, 
  DIAS, 
  unirIntervalos, 
  restarIntervalos, 
  formatearIntervalos, 
  Intervalo 
} from '../../utils/intervalos.js';
import { LaboratoriosService } from '../laboratorios/laboratorios.service.js';

export interface DatosDia {
  atencion: Intervalo[];
  refrigerios: Intervalo[];
  clases: Intervalo[];
  reservas: Intervalo[];
}

export class DisponibilidadService {
  static obtenerDatosDelDia(laboratorioId: number, fechaStr: string): DatosDia {
    const dt = validarFecha(fechaStr);
    if (!dt) throw new Error("Fecha inválida");

    // weekday: 0 = lunes ... 6 = domingo
    // Date.getUTCDay() devuelve 0 para domingo, 1 para lunes...
    const utcDay = dt.getUTCDay();
    const diaSemana = utcDay === 0 ? 6 : utcDay - 1;

    // Horarios de atención
    const turnos = db.prepare(`
      SELECT hora_inicio, hora_fin, refrigerio_inicio, refrigerio_fin 
      FROM horario_atencion 
      WHERE laboratorio_id = ? AND dia_semana = ?
    `).all(laboratorioId, diaSemana) as any[];

    const atencion: Intervalo[] = unirIntervalos(
      turnos.map(t => [aMin(t.hora_inicio), aMin(t.hora_fin)])
    );

    const refrigerios: Intervalo[] = turnos
      .filter(t => t.refrigerio_inicio && t.refrigerio_fin)
      .map(t => [aMin(t.refrigerio_inicio), aMin(t.refrigerio_fin)]);

    // Clases
    const clasesRows = db.prepare(`
      SELECT hora_inicio, hora_fin 
      FROM bloques_clase 
      WHERE laboratorio_id = ? AND dia_semana = ?
    `).all(laboratorioId, diaSemana) as any[];

    const clases: Intervalo[] = clasesRows.map(c => [aMin(c.hora_inicio), aMin(c.hora_fin)]);

    // Reservas activas
    const reservasRows = db.prepare(`
      SELECT hora_inicio, hora_fin 
      FROM reservas 
      WHERE laboratorio_id = ? AND fecha = ? AND estado = 'activa'
    `).all(laboratorioId, fechaStr) as any[];

    const reservas: Intervalo[] = reservasRows.map(r => [aMin(r.hora_inicio), aMin(r.hora_fin)]);

    return { atencion, refrigerios, clases, reservas };
  }

  static calcularDisponibilidad(labNombreOId: string | number, fechaStr: string) {
    const dt = validarFecha(fechaStr);
    if (!dt) {
      return { error: "Fecha inválida, usa el formato AAAA-MM-DD." };
    }

    const lab = typeof labNombreOId === 'number' 
      ? LaboratoriosService.obtenerPorId(labNombreOId)
      : LaboratoriosService.resolverLab(labNombreOId);

    if (!lab) {
      const labs = LaboratoriosService.listarTodos().map(l => l.nombre);
      return { error: "No reconozco ese laboratorio.", laboratorios_validos: labs };
    }

    if (!lab.permite_reserva) {
      return { 
        error: `${lab.nombre} no contempla reservas de horas libres; solo se puede consultar su reglamento y manual.` 
      };
    }

    const { atencion, refrigerios, clases, reservas } = this.obtenerDatosDelDia(lab.id, fechaStr);
    const bloqueados = [...refrigerios, ...clases, ...reservas];
    let libres = restarIntervalos(atencion, bloqueados);

    // Si la fecha consultada es HOY (hora Lima UTC-5), descartar o recortar las horas que ya pasaron
    const ahora = new Date();
    const ahoraLimaStr = new Date(ahora.getTime() - 5 * 3600000).toISOString();
    const hoyLimaFecha = ahoraLimaStr.substring(0, 10);
    const hoyLimaMinutos = parseInt(ahoraLimaStr.substring(11, 13)) * 60 + parseInt(ahoraLimaStr.substring(14, 16));

    if (fechaStr === hoyLimaFecha) {
      libres = libres
        .filter(([_, fin]) => fin > hoyLimaMinutos)
        .map(([ini, fin]) => [Math.max(ini, hoyLimaMinutos), fin] as Intervalo)
        .filter(([ini, fin]) => fin - ini >= 30); // Solo bloques de al menos 30 minutos
    } else if (fechaStr < hoyLimaFecha) {
      libres = [];
    }

    const utcDay = dt.getUTCDay();
    const diaIdx = utcDay === 0 ? 6 : utcDay - 1;
    const diaNombre = DIAS[diaIdx];

    if (atencion.length === 0) {
      return {
        laboratorio: lab.nombre,
        laboratorio_id: lab.id,
        fecha: fechaStr,
        dia: diaNombre,
        horas_libres: [],
        nota: "El laboratorio no atiende ese día."
      };
    }

    return {
      laboratorio: lab.nombre,
      laboratorio_id: lab.id,
      fecha: fechaStr,
      dia: diaNombre,
      horario_atencion: formatearIntervalos(atencion),
      horas_libres: formatearIntervalos(libres)
    };
  }
}
