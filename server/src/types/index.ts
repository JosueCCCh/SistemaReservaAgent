export interface Laboratorio {
  id: number;
  nombre: string;
  escuela: string;
  permite_reserva: number; // 1 o 0
}

export interface Equipo {
  id: number;
  laboratorio_id: number;
  codigo: string;
  nombre: string;
  estado: 'operativo' | 'mantenimiento' | 'baja';
}

export interface HorarioAtencion {
  id: number;
  laboratorio_id: number;
  dia_semana: number; // 0 = Lunes ... 6 = Domingo
  hora_inicio: string; // HH:MM
  hora_fin: string;
  refrigerio_inicio: string | null;
  refrigerio_fin: string | null;
}

export interface BloqueClase {
  id: number;
  laboratorio_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface Reserva {
  id: number;
  laboratorio_id: number;
  fecha: string; // YYYY-MM-DD
  hora_inicio: string; // HH:MM
  hora_fin: string;
  codigo_estudiante: string;
  nombre: string;
  correo: string;
  estado: 'activa' | 'cancelada';
  creada_en: string;
  laboratorio_nombre?: string;
}

export interface CorreoLog {
  id: number;
  reserva_id: number;
  tipo: 'confirmacion' | 'cancelacion';
  destinatario: string;
  asunto: string;
  cuerpo: string;
  estado: 'enviado' | 'simulado' | 'error';
  creado_en: string;
}

export interface ReglamentoFragmento {
  documento: string;
  laboratorio: string;
  escuela: string;
  tipo: string;
  referencia: string;
  texto: string;
}

export interface DisponibilidadResponse {
  laboratorio: string;
  laboratorio_id: number;
  fecha: string;
  dia: string;
  horario_atencion: string[];
  horas_libres: string[];
  nota?: string;
}
