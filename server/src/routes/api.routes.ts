import { Router, Request, Response } from 'express';
import { LaboratoriosService } from '../modules/laboratorios/laboratorios.service.js';
import { DisponibilidadService } from '../modules/disponibilidad/disponibilidad.service.js';
import { ReservasService } from '../modules/reservas/reservas.service.js';
import { ReglamentosService } from '../modules/reglamentos/reglamentos.service.js';
import { ChatService } from '../modules/chat/chat.service.js';
import { seedDatabase } from '../db/seed.js';
import { db } from '../db/index.js';

export const apiRouter = Router();

// M0: Inicialización y Seed en hosting cloud
apiRouter.get('/seed', (req: Request, res: Response) => {
  try {
    seedDatabase();
    const labs = LaboratoriosService.listarTodos();
    res.json({ ok: true, mensaje: 'Base de datos poblada exitosamente', laboratorios: labs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// M1: Laboratorios
apiRouter.get('/laboratorios', (req, res) => {
  try {
    const labs = LaboratoriosService.listarTodos();
    res.json(labs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/laboratorios/:id', (req, res) => {
  try {
    const lab = LaboratoriosService.obtenerPorId(Number(req.params.id));
    if (!lab) return res.status(404).json({ error: 'Laboratorio no encontrado' });
    res.json(lab);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// M2: Inventario de equipos
apiRouter.get('/equipos', (req, res) => {
  try {
    const { laboratorioId, estado, q } = req.query;
    let sql = 'SELECT e.*, l.nombre AS laboratorio_nombre FROM equipos e JOIN laboratorios l ON l.id = e.laboratorio_id WHERE 1=1';
    const params: any[] = [];

    if (laboratorioId) {
      sql += ' AND e.laboratorio_id = ?';
      params.push(Number(laboratorioId));
    }
    if (estado) {
      sql += ' AND e.estado = ?';
      params.push(String(estado));
    }
    if (q) {
      sql += ' AND (e.nombre LIKE ? OR e.codigo LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }

    sql += ' ORDER BY e.id ASC';
    const equipos = db.prepare(sql).all(...params);
    res.json(equipos);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// M3: Horarios de atención
apiRouter.get('/laboratorios/:id/horarios', (req, res) => {
  try {
    const labId = Number(req.params.id);
    const horarios = db.prepare('SELECT * FROM horario_atencion WHERE laboratorio_id = ? ORDER BY dia_semana').all(labId);
    res.json(horarios);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// M4: Disponibilidad
apiRouter.get('/disponibilidad', (req, res) => {
  try {
    const laboratorioId = req.query.laboratorioId || req.query.laboratorio_id;
    const { fecha } = req.query;
    if (!laboratorioId || !fecha) {
      return res.status(400).json({ error: 'Parámetros laboratorioId y fecha son requeridos' });
    }
    const resultado = DisponibilidadService.calcularDisponibilidad(Number(laboratorioId), String(fecha));
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// M5: Reservas
apiRouter.post('/reservas', async (req, res) => {
  try {
    const { laboratorioId, fecha, horaInicio, horaFin, codigoEstudiante, nombre, correo } = req.body;
    const resultado = await ReservasService.crearReserva({
      laboratorio: Number(laboratorioId),
      fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      codigo_estudiante: codigoEstudiante,
      nombre,
      correo
    });
    if (!resultado.ok) {
      return res.status(400).json(resultado);
    }
    res.status(201).json(resultado);
  } catch (err: any) {
    res.status(500).json({ ok: false, motivo: err.message });
  }
});

apiRouter.delete('/reservas/:id', async (req, res) => {
  try {
    const { codigoEstudiante } = req.body;
    if (!codigoEstudiante) {
      return res.status(400).json({ ok: false, motivo: 'El código de estudiante es requerido para cancelar.' });
    }
    const resultado = await ReservasService.cancelarReserva(Number(req.params.id), String(codigoEstudiante));
    if (!resultado.ok) {
      return res.status(400).json(resultado);
    }
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ ok: false, motivo: err.message });
  }
});

apiRouter.get('/reservas', (req, res) => {
  try {
    const laboratorioId = req.query.laboratorioId || req.query.laboratorio_id;
    const codigoEstudiante = req.query.codigoEstudiante || req.query.codigo || req.query.codigo_estudiante;
    const { fecha } = req.query;
    const reservas = ReservasService.listarReservas({
      laboratorioId: laboratorioId ? Number(laboratorioId) : undefined,
      fecha: fecha ? String(fecha) : undefined,
      codigoEstudiante: codigoEstudiante ? String(codigoEstudiante) : undefined
    });
    res.json(reservas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// M6: Calendario (Ocupación: reservas, clases, refrigerios)
apiRouter.get('/calendario', (req, res) => {
  try {
    const laboratorioId = req.query.laboratorioId || req.query.laboratorio_id;
    const { fecha } = req.query;
    if (!laboratorioId || !fecha) {
      return res.status(400).json({ error: 'laboratorioId y fecha son requeridos' });
    }
    const lab = LaboratoriosService.obtenerPorId(Number(laboratorioId));
    if (!lab) return res.status(404).json({ error: 'Laboratorio no encontrado' });

    const datos = DisponibilidadService.obtenerDatosDelDia(lab.id, String(fecha));
    res.json({
      laboratorio: lab.nombre,
      fecha,
      datos
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// M7: Historial de correos
apiRouter.get('/correos', (req, res) => {
  try {
    const { reservaId } = req.query;
    let sql = 'SELECT * FROM correos';
    const params: any[] = [];
    if (reservaId) {
      sql += ' WHERE reserva_id = ?';
      params.push(Number(reservaId));
    }
    sql += ' ORDER BY id DESC LIMIT 50';
    const logs = db.prepare(sql).all(...params);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// M8: Reglamentos (RAG)
apiRouter.get('/reglamentos/buscar', (req, res) => {
  try {
    const { q, laboratorio } = req.query;
    const resultado = ReglamentosService.buscarReglamentos(String(q || ''), laboratorio ? String(laboratorio) : undefined);
    res.json(resultado);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/reglamentos/documentos', (req, res) => {
  try {
    const docs = ReglamentosService.listarDocumentos();
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// M9: Asistente IA (Chatbot)
apiRouter.post('/chat', async (req, res) => {
  try {
    const { mensaje, historial } = req.body;
    if (!mensaje || !mensaje.trim()) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }
    const respuesta = await ChatService.procesarMensaje(historial || [], mensaje);
    res.json({ respuesta });
  } catch (err: any) {
    console.error('Error en /chat:', err);
    res.status(500).json({ error: err.message || 'Error procesando consulta con el agente' });
  }
});
