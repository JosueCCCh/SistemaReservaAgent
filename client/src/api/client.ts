export interface Laboratorio {
  id: number;
  nombre: string;
  escuela: string;
  permite_reserva: number;
}

export interface Equipo {
  id: number;
  laboratorio_id: number;
  codigo: string;
  nombre: string;
  estado: 'operativo' | 'mantenimiento' | 'baja';
  laboratorio_nombre?: string;
}

export interface DisponibilidadResponse {
  laboratorio: string;
  laboratorio_id: number;
  fecha: string;
  dia: string;
  horario_atencion: string[];
  horas_libres: string[];
  nota?: string;
  error?: string;
}

export interface Reserva {
  id: number;
  laboratorio_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  codigo_estudiante: string;
  nombre: string;
  correo: string;
  estado: 'activa' | 'cancelada';
  creada_en: string;
  laboratorio_nombre?: string;
}

export interface FragmentoCita {
  cita: string;
  laboratorio: string;
  escuela: string;
  tipo: string;
  texto: string;
}

export const api = {
  async getLaboratorios(): Promise<Laboratorio[]> {
    const res = await fetch('/api/laboratorios');
    return res.json();
  },

  async getEquipos(params?: { laboratorioId?: number; estado?: string; q?: string }): Promise<Equipo[]> {
    const query = new URLSearchParams();
    if (params?.laboratorioId) query.set('laboratorioId', String(params.laboratorioId));
    if (params?.estado) query.set('estado', params.estado);
    if (params?.q) query.set('q', params.q);
    const res = await fetch(`/api/equipos?${query}`);
    return res.json();
  },

  async getDisponibilidad(laboratorioId: number, fecha: string): Promise<DisponibilidadResponse> {
    const res = await fetch(`/api/disponibilidad?laboratorioId=${laboratorioId}&fecha=${fecha}`);
    return res.json();
  },

  async getCalendario(laboratorioId: number, fecha: string) {
    const res = await fetch(`/api/calendario?laboratorioId=${laboratorioId}&fecha=${fecha}`);
    return res.json();
  },

  async crearReserva(data: {
    laboratorioId: number;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    codigoEstudiante: string;
    nombre: string;
    correo: string;
  }) {
    const res = await fetch('/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async cancelarReserva(reservaId: number, codigoEstudiante: string) {
    const res = await fetch(`/api/reservas/${reservaId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoEstudiante })
    });
    return res.json();
  },

  async getReservas(codigoEstudiante?: string): Promise<Reserva[]> {
    const query = new URLSearchParams();
    if (codigoEstudiante) query.set('codigoEstudiante', codigoEstudiante);
    const res = await fetch(`/api/reservas?${query}`);
    return res.json();
  },

  async buscarReglamentos(q: string, laboratorio?: string): Promise<{ resultados: FragmentoCita[]; nota?: string; error?: string }> {
    const query = new URLSearchParams({ q });
    if (laboratorio) query.set('laboratorio', laboratorio);
    const res = await fetch(`/api/reglamentos/buscar?${query}`);
    return res.json();
  },

  async getDocumentos() {
    const res = await fetch('/api/reglamentos/documentos');
    return res.json();
  },

  async enviarChat(mensaje: string, historial: { role: string; content: string }[]) {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje, historial })
    });
    return res.json();
  }
};
