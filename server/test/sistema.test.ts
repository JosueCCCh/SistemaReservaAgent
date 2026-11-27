import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';
import { DisponibilidadService } from '../src/modules/disponibilidad/disponibilidad.service.js';
import { ReglamentosService } from '../src/modules/reglamentos/reglamentos.service.js';
import { ReservasService } from '../src/modules/reservas/reservas.service.js';
import { NotificacionesService } from '../src/modules/notificaciones/notificaciones.service.js';

describe('Sistema de Reserva de Laboratorios URP - Tests', () => {
  beforeAll(() => {
    seedDatabase();
    vi.spyOn(NotificacionesService, 'enviarCorreo').mockResolvedValue({
      destinatario: 'cordovachavezjosueluis@gmail.com',
      estado: 'enviado'
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
    db.close();
  });

  it('debe calcular la disponibilidad de horas libres en Circuitos y Dispositivos', () => {
    const disp = DisponibilidadService.calcularDisponibilidad('Circuitos y Dispositivos', '2026-11-30');
    expect(disp).toBeDefined();
    expect(disp.laboratorio).toBe('Circuitos y Dispositivos');
    expect(disp.horas_libres).toBeInstanceOf(Array);
    // Para el lunes (clases 08:00-10:00 y 14:00-16:00, ref 13:00-14:00), queda 10:00-13:00 y 16:00-17:00
    expect(disp.horas_libres).toContain('10:00 a 13:00');
    expect(disp.horas_libres).toContain('16:00 a 17:00');
  });

  it('debe buscar en los reglamentos (RAG) y retornar cita de artículo', () => {
    const res = ReglamentosService.buscarReglamentos('minutos de tolerancia', 'Circuitos y Dispositivos');
    expect(res.resultados).toBeInstanceOf(Array);
    expect(res.resultados.length).toBeGreaterThan(0);
    expect(res.resultados[0].cita).toContain('Art. 17');
    expect(res.resultados[0].texto).toContain('15 minutos');
  });

  it('debe registrar y validar la creación de una reserva', async () => {
    const resultado = await ReservasService.crearReserva({
      laboratorio: 'Circuitos y Dispositivos',
      fecha: '2026-11-30',
      hora_inicio: '10:00',
      hora_fin: '12:00',
      codigo_estudiante: '202311373',
      nombre: 'Josue Cordova',
      correo: 'cordovachavezjosueluis@gmail.com'
    });

    expect(resultado.ok).toBe(true);
    expect(resultado.reserva_id).toBeDefined();
    expect(resultado.correo_destinatario).toBe('cordovachavezjosueluis@gmail.com');
  });

  it('debe rechazar una reserva en horario ocupado o duplicado', async () => {
    const intentoDuplicado = await ReservasService.crearReserva({
      laboratorio: 'Circuitos y Dispositivos',
      fecha: '2026-11-30',
      hora_inicio: '10:00',
      hora_fin: '12:00',
      codigo_estudiante: '202311373',
      nombre: 'Josue Cordova',
      correo: 'cordovachavezjosueluis@gmail.com'
    });

    expect(intentoDuplicado.ok).toBe(false);
    expect(intentoDuplicado.motivo).toMatch(/(ya hay una reserva activa|Ya tienes registrada la reserva)/);
  });

  it('debe indicar que Telecomunicaciones no contempla reservas individuales', () => {
    const disp = DisponibilidadService.calcularDisponibilidad('Telecomunicaciones', '2026-11-30');
    expect(disp).toBeDefined();
    expect(disp.error).toContain('no contempla reservas');
    expect(disp.horas_libres).toBeUndefined();
  });

  it('debe buscar reglamentos sobre prohibición de alimentos (Art. 20)', () => {
    const res = ReglamentosService.buscarReglamentos('alimentos bebidas fumar');
    expect(res.resultados.length).toBeGreaterThan(0);
    expect(res.resultados[0].cita).toContain('Art. 20');
    expect(res.resultados[0].texto).toContain('alimentos');
  });

  it('debe cancelar una reserva existente con el código de estudiante correcto', async () => {
    // Buscar la reserva creada
    const misReservas = ReservasService.listarReservas({ codigoEstudiante: '202311373' });
    expect(misReservas.length).toBeGreaterThan(0);
    const reservaId = misReservas[0].id;

    // Intentar cancelar con código incorrecto
    const intentoFallido = await ReservasService.cancelarReserva(reservaId, '999999999');
    expect(intentoFallido.ok).toBe(false);
    expect(intentoFallido.motivo).toContain('no coincide');

    // Cancelar con código correcto
    const cancelacion = await ReservasService.cancelarReserva(reservaId, '202311373');
    expect(cancelacion.ok).toBe(true);

    // Verificar que el estado ahora es 'cancelada'
    const reservasActualizadas = ReservasService.listarReservas({ codigoEstudiante: '202311373' });
    const reservaCancelada = reservasActualizadas.find(r => r.id === reservaId);
    expect(reservaCancelada?.estado).toBe('cancelada');
  });
});
