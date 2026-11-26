import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  CalendarCheck, 
  Clock, 
  Wrench, 
  BookOpen, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Trash2
} from 'lucide-react';
import { api } from './api/client';
import type { Laboratorio, Equipo, Reserva, DisponibilidadResponse, FragmentoCita } from './api/client';
import { ChatWidget } from './components/ChatWidget';

export function App() {
  const [activeTab, setActiveTab] = useState<'inicio' | 'laboratorios' | 'reservar' | 'mis-reservas' | 'equipos' | 'reglamentos'>('inicio');

  // Estados comunes
  const [laboratorios, setLaboratorios] = useState<Laboratorio[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(false);

  // Estados de reserva
  const [selectedLabId, setSelectedLabId] = useState<number>(1);
  const [selectedFecha, setSelectedFecha] = useState<string>(new Date().toISOString().substring(0, 10));
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadResponse | null>(null);
  const [formReserva, setFormReserva] = useState({
    horaInicio: '',
    horaFin: '',
    codigoEstudiante: '',
    nombre: '',
    correo: ''
  });
  const [reservaResultado, setReservaResultado] = useState<any>(null);

  // Estados de cancelación
  const [buscarCodigo, setBuscarCodigo] = useState('');
  const [misReservas, setMisReservas] = useState<Reserva[]>([]);

  // Estados de reglamentos (RAG)
  const [queryReglamento, setQueryReglamento] = useState('');
  const [resultadosRAG, setResultadosRAG] = useState<FragmentoCita[]>([]);

  // Carga inicial
  useEffect(() => {
    cargarDatosGenerales();
  }, []);

  const cargarDatosGenerales = async () => {
    try {
      const [labs, eq, res] = await Promise.all([
        api.getLaboratorios(),
        api.getEquipos(),
        api.getReservas()
      ]);
      setLaboratorios(labs);
      setEquipos(eq);
      setReservas(res);
    } catch (err) {
      console.error(err);
    }
  };

  // Consultar disponibilidad al cambiar lab o fecha
  useEffect(() => {
    if (activeTab === 'reservar' && selectedLabId && selectedFecha) {
      cargarDisponibilidad();
    }
  }, [activeTab, selectedLabId, selectedFecha]);

  const cargarDisponibilidad = async () => {
    setLoading(true);
    try {
      const res = await api.getDisponibilidad(selectedLabId, selectedFecha);
      setDisponibilidad(res);
      setReservaResultado(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCrearReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.crearReserva({
        laboratorioId: selectedLabId,
        fecha: selectedFecha,
        ...formReserva
      });
      setReservaResultado(res);
      if (res.ok) {
        cargarDisponibilidad();
        cargarDatosGenerales();
        setFormReserva({
          horaInicio: '',
          horaFin: '',
          codigoEstudiante: '',
          nombre: '',
          correo: ''
        });
      }
    } catch (err: any) {
      setReservaResultado({ ok: false, motivo: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarMisReservas = async () => {
    if (!buscarCodigo.trim()) return;
    setLoading(true);
    try {
      const res = await api.getReservas(buscarCodigo.trim());
      setMisReservas(res);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarReserva = async (id: number) => {
    if (!confirm('¿Seguro que deseas cancelar esta reserva?')) return;
    try {
      const res = await api.cancelarReserva(id, buscarCodigo.trim());
      if (res.ok) {
        alert('Reserva cancelada exitosamente.');
        handleBuscarMisReservas();
        cargarDatosGenerales();
      } else {
        alert(res.motivo || 'Error cancelando reserva');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBuscarReglamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryReglamento.trim()) return;
    setLoading(true);
    try {
      const res = await api.buscarReglamentos(queryReglamento);
      setResultadosRAG(res.resultados || []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">URP</div>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Laboratorios URP</h2>
            <p style={{ fontSize: '12px', color: '#94a3b8' }}>Sistema de Reservas</p>
          </div>
        </div>

        <nav>
          <div className={`nav-item ${activeTab === 'inicio' ? 'active' : ''}`} onClick={() => setActiveTab('inicio')}>
            <LayoutDashboard size={18} /> Inicio
          </div>
          <div className={`nav-item ${activeTab === 'laboratorios' ? 'active' : ''}`} onClick={() => setActiveTab('laboratorios')}>
            <Building2 size={18} /> Laboratorios
          </div>
          <div className={`nav-item ${activeTab === 'reservar' ? 'active' : ''}`} onClick={() => setActiveTab('reservar')}>
            <CalendarCheck size={18} /> Disponibilidad y Reserva
          </div>
          <div className={`nav-item ${activeTab === 'mis-reservas' ? 'active' : ''}`} onClick={() => setActiveTab('mis-reservas')}>
            <Clock size={18} /> Mis Reservas
          </div>
          <div className={`nav-item ${activeTab === 'equipos' ? 'active' : ''}`} onClick={() => setActiveTab('equipos')}>
            <Wrench size={18} /> Inventario de Equipos
          </div>
          <div className={`nav-item ${activeTab === 'reglamentos' ? 'active' : ''}`} onClick={() => setActiveTab('reglamentos')}>
            <BookOpen size={18} /> Reglamentos (RAG)
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* VISTA 1: INICIO */}
        {activeTab === 'inicio' && (
          <div>
            <h1 style={{ fontSize: '26px', marginBottom: '20px' }}>Panel de Control General</h1>
            <div className="grid-cols-3">
              <div className="card">
                <p style={{ color: '#64748b', fontSize: '13px' }}>Laboratorios Activos</p>
                <h3 style={{ fontSize: '28px', margin: '8px 0' }}>{laboratorios.length}</h3>
                <span className="badge badge-info">2 con reserva de horas libres</span>
              </div>
              <div className="card">
                <p style={{ color: '#64748b', fontSize: '13px' }}>Equipos Registrados</p>
                <h3 style={{ fontSize: '28px', margin: '8px 0' }}>{equipos.length}</h3>
                <span className="badge badge-success">Inventario Operativo</span>
              </div>
              <div className="card">
                <p style={{ color: '#64748b', fontSize: '13px' }}>Reservas Registradas</p>
                <h3 style={{ fontSize: '28px', margin: '8px 0' }}>{reservas.length}</h3>
                <span className="badge badge-warning">Activas y Auditoría</span>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '14px' }}>Accesos Rápidos</h3>
              <div style={{ display: 'flex', gap: '14px' }}>
                <button className="btn btn-primary" onClick={() => setActiveTab('reservar')}>
                  <CalendarCheck size={18} /> Reservar Hora Libre
                </button>
                <button className="btn btn-outline" onClick={() => setActiveTab('reglamentos')}>
                  <BookOpen size={18} /> Consultar Reglamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: LABORATORIOS */}
        {activeTab === 'laboratorios' && (
          <div>
            <h1 style={{ fontSize: '26px', marginBottom: '20px' }}>Laboratorios de la Facultad</h1>
            <div className="grid-cols-2">
              {laboratorios.map(lab => (
                <div key={lab.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', marginBottom: '6px' }}>{lab.nombre}</h3>
                      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '12px' }}>Escuela: {lab.escuela}</p>
                    </div>
                    {lab.permite_reserva ? (
                      <span className="badge badge-success">Reservable</span>
                    ) : (
                      <span className="badge badge-warning">Solo Consulta</span>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', gap: '10px' }}>
                    {lab.permite_reserva ? (
                      <button className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => { setSelectedLabId(lab.id); setActiveTab('reservar'); }}>
                        Ver Disponibilidad
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#64748b' }}>No admite reservas individuales de estudiantes</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 3: RESERVAR Y DISPONIBILIDAD */}
        {activeTab === 'reservar' && (
          <div>
            <h1 style={{ fontSize: '26px', marginBottom: '20px' }}>Disponibilidad y Creación de Reservas</h1>
            
            <div className="card">
              <div className="grid-cols-2">
                <div className="form-group">
                  <label className="form-label">Laboratorio</label>
                  <select 
                    className="form-control" 
                    value={selectedLabId} 
                    onChange={(e) => setSelectedLabId(Number(e.target.value))}
                  >
                    {laboratorios.map(l => (
                      <option key={l.id} value={l.id} disabled={!l.permite_reserva}>
                        {l.nombre} {!l.permite_reserva ? '(Solo consulta)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={selectedFecha} 
                    onChange={(e) => setSelectedFecha(e.target.value)} 
                  />
                </div>
              </div>

              {/* Franja de Horas Libres */}
              <div style={{ marginTop: '16px' }}>
                <h4 style={{ fontSize: '14px', color: '#475569' }}>Horas libres disponibles para el {selectedFecha}:</h4>
                {disponibilidad?.error ? (
                  <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '6px' }}>{disponibilidad.error}</p>
                ) : disponibilidad?.horas_libres && disponibilidad.horas_libres.length > 0 ? (
                  <div className="timeline-container">
                    {disponibilidad.horas_libres.map((franja, i) => {
                      const [ini, fin] = franja.split(' a ');
                      return (
                        <div 
                          key={i} 
                          className="slot-pill" 
                          onClick={() => setFormReserva({ ...formReserva, horaInicio: ini, horaFin: fin })}
                          title="Clic para autocompletar horario"
                        >
                          🟢 {franja}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '6px' }}>
                    {disponibilidad?.nota || 'No hay bloques libres para este día.'}
                  </p>
                )}
              </div>
            </div>

            {/* Formulario de reserva */}
            <div className="card">
              <h3 style={{ marginBottom: '16px' }}>Formulario de Reserva</h3>
              <form onSubmit={handleCrearReserva}>
                <div className="grid-cols-2">
                  <div className="form-group">
                    <label className="form-label">Hora Inicio (HH:MM)</label>
                    <input 
                      type="text" 
                      placeholder="08:00" 
                      className="form-control" 
                      value={formReserva.horaInicio} 
                      onChange={(e) => setFormReserva({ ...formReserva, horaInicio: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hora Fin (HH:MM)</label>
                    <input 
                      type="text" 
                      placeholder="10:00" 
                      className="form-control" 
                      value={formReserva.horaFin} 
                      onChange={(e) => setFormReserva({ ...formReserva, horaFin: e.target.value })} 
                      required 
                    />
                  </div>
                </div>

                <div className="grid-cols-3">
                  <div className="form-group">
                    <label className="form-label">Código Estudiante</label>
                    <input 
                      type="text" 
                      placeholder="202311373" 
                      className="form-control" 
                      value={formReserva.codigoEstudiante} 
                      onChange={(e) => setFormReserva({ ...formReserva, codigoEstudiante: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nombres y Apellidos</label>
                    <input 
                      type="text" 
                      placeholder="Josué Córdova" 
                      className="form-control" 
                      value={formReserva.nombre} 
                      onChange={(e) => setFormReserva({ ...formReserva, nombre: e.target.value })} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Correo Electrónico</label>
                    <input 
                      type="email" 
                      placeholder="estudiante@urp.edu.pe" 
                      className="form-control" 
                      value={formReserva.correo} 
                      onChange={(e) => setFormReserva({ ...formReserva, correo: e.target.value })} 
                      required 
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '10px' }}>
                  Confirmar y Guardar Reserva
                </button>
              </form>

              {/* Mensajes de respuesta */}
              {reservaResultado && (
                <div style={{ marginTop: '20px', padding: '16px', borderRadius: '8px', background: reservaResultado.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${reservaResultado.ok ? '#bbf7d0' : '#fecaca'}` }}>
                  {reservaResultado.ok ? (
                    <div>
                      <h4 style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle2 size={18} /> ¡Reserva Exitosa! (N.º {reservaResultado.reserva_id})
                      </h4>
                      <p style={{ fontSize: '13px', marginTop: '6px', color: '#14532d' }}>
                        Se ha registrado para <strong>{reservaResultado.estudiante}</strong> en <strong>{reservaResultado.laboratorio}</strong> de {reservaResultado.hora_inicio} a {reservaResultado.hora_fin}.
                      </p>
                      <p style={{ fontSize: '12px', marginTop: '4px', color: '#15803d' }}>
                        Estado correo: <strong>{reservaResultado.correo_estado}</strong> hacia {reservaResultado.correo_destinatario}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <h4 style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={18} /> Rechazo de Reserva
                      </h4>
                      <p style={{ fontSize: '13px', marginTop: '6px', color: '#7f1d1d' }}>{reservaResultado.motivo}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VISTA 4: MIS RESERVAS / CANCELAR */}
        {activeTab === 'mis-reservas' && (
          <div>
            <h1 style={{ fontSize: '26px', marginBottom: '20px' }}>Mis Reservas / Cancelación</h1>
            <div className="card">
              <div style={{ display: 'flex', gap: '12px', maxWidth: '480px' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ingresa tu código de estudiante (ej. 202311373)"
                  value={buscarCodigo}
                  onChange={(e) => setBuscarCodigo(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleBuscarMisReservas}>
                  <Search size={16} /> Buscar
                </button>
              </div>

              <div style={{ marginTop: '24px' }}>
                {misReservas.length > 0 ? (
                  <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '13px' }}>
                        <th style={{ padding: '10px' }}>N.º</th>
                        <th style={{ padding: '10px' }}>Laboratorio</th>
                        <th style={{ padding: '10px' }}>Fecha</th>
                        <th style={{ padding: '10px' }}>Horario</th>
                        <th style={{ padding: '10px' }}>Estado</th>
                        <th style={{ padding: '10px' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {misReservas.map(r => (
                        <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '14px' }}>
                          <td style={{ padding: '12px 10px' }}>#{r.id}</td>
                          <td style={{ padding: '12px 10px' }}>{r.laboratorio_nombre}</td>
                          <td style={{ padding: '12px 10px' }}>{r.fecha}</td>
                          <td style={{ padding: '12px 10px' }}>{r.hora_inicio} a {r.hora_fin}</td>
                          <td style={{ padding: '12px 10px' }}>
                            <span className={`badge ${r.estado === 'activa' ? 'badge-success' : 'badge-danger'}`}>
                              {r.estado}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            {r.estado === 'activa' && (
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                onClick={() => handleCancelarReserva(r.id)}
                              >
                                <Trash2 size={14} /> Cancelar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>No hay reservas mostradas. Ingresa un código universitario para consultar.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VISTA 5: INVENTARIO */}
        {activeTab === 'equipos' && (
          <div>
            <h1 style={{ fontSize: '26px', marginBottom: '20px' }}>Inventario de Equipos</h1>
            <div className="card">
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '13px' }}>
                    <th style={{ padding: '10px' }}>Código</th>
                    <th style={{ padding: '10px' }}>Equipo</th>
                    <th style={{ padding: '10px' }}>Laboratorio</th>
                    <th style={{ padding: '10px' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {equipos.map(eq => (
                    <tr key={eq.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '14px' }}>
                      <td style={{ padding: '12px 10px', fontWeight: 600 }}>{eq.codigo}</td>
                      <td style={{ padding: '12px 10px' }}>{eq.nombre}</td>
                      <td style={{ padding: '12px 10px' }}>{eq.laboratorio_nombre}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span className={`badge ${eq.estado === 'operativo' ? 'badge-success' : 'badge-warning'}`}>
                          {eq.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 6: REGLAMENTOS (RAG) */}
        {activeTab === 'reglamentos' && (
          <div>
            <h1 style={{ fontSize: '26px', marginBottom: '20px' }}>Reglamentos y Manuales (Búsqueda RAG)</h1>
            <div className="card">
              <form onSubmit={handleBuscarReglamento} style={{ display: 'flex', gap: '12px', maxWidth: '640px' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: minutos de tolerancia para entrar, carné universitario, alimentos..."
                  value={queryReglamento}
                  onChange={(e) => setQueryReglamento(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">
                  <Search size={16} /> Consultar
                </button>
              </form>

              <div style={{ marginTop: '24px' }}>
                {resultadosRAG.map((item, i) => (
                  <div key={i} style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="badge badge-info">{item.cita}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Lab: {item.laboratorio}</span>
                    </div>
                    <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#334155' }}>
                      {item.texto}
                    </p>
                  </div>
                ))}
                {resultadosRAG.length === 0 && (
                  <p style={{ color: '#94a3b8', fontSize: '14px' }}>Realiza una búsqueda semántica en los reglamentos de la facultad.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Widget flotante del Asistente IA */}
      <ChatWidget />
    </div>
  );
}

export default App;
