import React, { useState, useEffect, lazy, Suspense } from 'react';
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
  Trash2,
  ShieldCheck,
  Check,
  Loader2,
  UserCheck
} from 'lucide-react';
import { api } from './api/client';
import type { Laboratorio, Equipo, Reserva, DisponibilidadResponse, FragmentoCita } from './api/client';

const ChatWidget = lazy(() => import('./components/ChatWidget').then(m => ({ default: m.ChatWidget })));

const getTodayLima = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const lima = new Date(utc - (5 * 3600000));
  return lima.toISOString().substring(0, 10);
};

const getTomorrowLima = () => {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const lima = new Date(utc - (5 * 3600000) + 86400000);
  return lima.toISOString().substring(0, 10);
};

const timeToMin = (hhmm: string): number => {
  if (!hhmm || !hhmm.includes(':')) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minToHHMM = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export function App() {
  const [activeTab, setActiveTab] = useState<'inicio' | 'laboratorios' | 'reservar' | 'mis-reservas' | 'equipos' | 'reglamentos'>('inicio');

  // Estados comunes
  const [laboratorios, setLaboratorios] = useState<Laboratorio[]>([]);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Estados de reserva
  const [selectedLabId, setSelectedLabId] = useState<number>(1);
  const [selectedFecha, setSelectedFecha] = useState<string>(getTodayLima());
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadResponse | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [durationMode, setDurationMode] = useState<'full' | '1h' | '2h' | 'custom'>('full');
  const [clientErrors, setClientErrors] = useState<{ [key: string]: string }>({});
  const [perfilGuardado, setPerfilGuardado] = useState(false);
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

  // Carga inicial y perfil recordado
  useEffect(() => {
    cargarDatosGenerales();
    try {
      const saved = localStorage.getItem('urp_reserva_estudiante');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.codigoEstudiante && parsed.nombre && parsed.correo) {
          setFormReserva(prev => ({
            ...prev,
            codigoEstudiante: parsed.codigoEstudiante,
            nombre: parsed.nombre,
            correo: parsed.correo
          }));
          setPerfilGuardado(true);
        }
      }
    } catch (e) {
      console.warn('No se pudo cargar perfil local', e);
    }
  }, []);

  const cargarDatosGenerales = async () => {
    setErrorCarga(null);
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
      setErrorCarga('No se pudo conectar con el servidor de laboratorios. Verifica que el backend esté activo.');
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
      // Validar si el slot seleccionado sigue existiendo
      if (selectedSlot && (!res.horas_libres || !res.horas_libres.includes(selectedSlot))) {
        setSelectedSlot(null);
        setFormReserva(prev => ({ ...prev, horaInicio: '', horaFin: '' }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getSlotBounds = (slot: string) => {
    const parts = slot.split(' a ');
    const startStr = parts[0] || '08:00';
    const endStr = parts[1] || '10:00';
    return {
      startStr,
      endStr,
      startMin: timeToMin(startStr),
      endMin: timeToMin(endStr)
    };
  };

  const handleSelectSlot = (slot: string) => {
    setSelectedSlot(slot);
    const { startStr, endStr } = getSlotBounds(slot);
    setDurationMode('full');
    setFormReserva(prev => ({
      ...prev,
      horaInicio: startStr,
      horaFin: endStr
    }));
    setClientErrors(prev => ({ ...prev, slot: '', horario: '' }));
  };

  const handleSelectDuration = (mode: 'full' | '1h' | '2h' | 'custom') => {
    if (!selectedSlot) return;
    setDurationMode(mode);
    const { startStr, endStr, startMin, endMin } = getSlotBounds(selectedSlot);

    if (mode === 'full') {
      setFormReserva(prev => ({ ...prev, horaInicio: startStr, horaFin: endStr }));
    } else if (mode === '1h') {
      const end1h = Math.min(startMin + 60, endMin);
      setFormReserva(prev => ({ ...prev, horaInicio: startStr, horaFin: minToHHMM(end1h) }));
    } else if (mode === '2h') {
      const end2h = Math.min(startMin + 120, endMin);
      setFormReserva(prev => ({ ...prev, horaInicio: startStr, horaFin: minToHHMM(end2h) }));
    }
  };

  const getAvailableStartTimes = (slot: string) => {
    const { startMin, endMin } = getSlotBounds(slot);
    const options: string[] = [];
    for (let m = startMin; m < endMin; m += 30) {
      options.push(minToHHMM(m));
    }
    return options;
  };

  const getAvailableEndTimes = (slot: string, currentStart: string) => {
    const { endMin } = getSlotBounds(slot);
    const startMin = timeToMin(currentStart || slot.split(' a ')[0]);
    const options: string[] = [];
    for (let m = startMin + 30; m <= endMin; m += 30) {
      options.push(minToHHMM(m));
    }
    return options;
  };

  const handleCrearReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!selectedSlot) {
      errors.slot = "Debes seleccionar un bloque de horas libres disponible.";
    }

    if (!formReserva.horaInicio || !formReserva.horaFin) {
      errors.horario = "Debes seleccionar la hora de inicio y de fin.";
    } else if (timeToMin(formReserva.horaFin) <= timeToMin(formReserva.horaInicio)) {
      errors.horario = "La hora de fin debe ser posterior a la de inicio.";
    }

    const cod = formReserva.codigoEstudiante.trim();
    if (!cod) {
      errors.codigo = "El código universitario es obligatorio.";
    } else if (!/^\d{8,10}$/.test(cod)) {
      errors.codigo = "El código debe tener entre 8 y 10 dígitos numéricos (ej. 202311373).";
    }

    const nom = formReserva.nombre.trim();
    if (!nom || nom.length < 3) {
      errors.nombre = "Ingresa tu nombre y apellido completo (mínimo 3 caracteres).";
    }

    const email = formReserva.correo.trim().toLowerCase();
    if (!email) {
      errors.correo = "El correo electrónico es obligatorio.";
    } else if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email)) {
      errors.correo = "Ingresa un correo electrónico con formato válido.";
    }

    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }

    setClientErrors({});
    setLoading(true);
    try {
      const res = await api.crearReserva({
        laboratorioId: selectedLabId,
        fecha: selectedFecha,
        horaInicio: formReserva.horaInicio,
        horaFin: formReserva.horaFin,
        codigoEstudiante: cod,
        nombre: nom,
        correo: email
      });
      setReservaResultado(res);
      if (res.ok) {
        // Guardar perfil para visitas futuras
        try {
          localStorage.setItem('urp_reserva_estudiante', JSON.stringify({
            codigoEstudiante: cod,
            nombre: nom,
            correo: email
          }));
          setPerfilGuardado(true);
        } catch (e) {
          console.warn('Error al guardar perfil', e);
        }

        cargarDisponibilidad();
        cargarDatosGenerales();
        setSelectedSlot(null);
        setFormReserva(prev => ({
          ...prev,
          horaInicio: '',
          horaFin: ''
        }));
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
    if (!confirm('¿Estás seguro de cancelar esta reserva? El puesto se liberará de inmediato para que otros estudiantes puedan reservarlo.')) return;
    try {
      const res = await api.cancelarReserva(id, buscarCodigo.trim());
      if (res.ok) {
        alert('Reserva cancelada exitosamente. El horario ha quedado liberado.');
        handleBuscarMisReservas();
        cargarDatosGenerales();
      } else {
        alert(res.motivo || 'No se pudo cancelar la reserva.');
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
            <p style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>Sistema de Reservas</p>
          </div>
        </div>

        <nav aria-label="Navegación principal">
          <button type="button" className={`nav-item ${activeTab === 'inicio' ? 'active' : ''}`} aria-current={activeTab === 'inicio' ? 'page' : undefined} onClick={() => setActiveTab('inicio')}>
            <LayoutDashboard size={18} aria-hidden="true" /> Inicio
          </button>
          <button type="button" className={`nav-item ${activeTab === 'laboratorios' ? 'active' : ''}`} aria-current={activeTab === 'laboratorios' ? 'page' : undefined} onClick={() => setActiveTab('laboratorios')}>
            <Building2 size={18} aria-hidden="true" /> Laboratorios
          </button>
          <button type="button" className={`nav-item ${activeTab === 'reservar' ? 'active' : ''}`} aria-current={activeTab === 'reservar' ? 'page' : undefined} onClick={() => setActiveTab('reservar')}>
            <CalendarCheck size={18} aria-hidden="true" /> Disponibilidad y Reserva
          </button>
          <button type="button" className={`nav-item ${activeTab === 'mis-reservas' ? 'active' : ''}`} aria-current={activeTab === 'mis-reservas' ? 'page' : undefined} onClick={() => setActiveTab('mis-reservas')}>
            <Clock size={18} aria-hidden="true" /> Mis Reservas
          </button>
          <button type="button" className={`nav-item ${activeTab === 'equipos' ? 'active' : ''}`} aria-current={activeTab === 'equipos' ? 'page' : undefined} onClick={() => setActiveTab('equipos')}>
            <Wrench size={18} aria-hidden="true" /> Inventario de Equipos
          </button>
          <button type="button" className={`nav-item ${activeTab === 'reglamentos' ? 'active' : ''}`} aria-current={activeTab === 'reglamentos' ? 'page' : undefined} onClick={() => setActiveTab('reglamentos')}>
            <BookOpen size={18} aria-hidden="true" /> Reglamentos
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {errorCarga && (
          <div className="error-banner" role="alert">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} aria-hidden="true" />
              <span>{errorCarga}</span>
            </div>
            <button type="button" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={cargarDatosGenerales}>
              Reintentar
            </button>
          </div>
        )}

        {/* VISTA 1: INICIO */}
        {activeTab === 'inicio' && (
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '20px', lineHeight: 1.3 }}>Panel de Control General</h1>
            <div className="grid-cols-3">
              <div className="card">
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Laboratorios Activos</p>
                <p className="stat-num">{laboratorios.length}</p>
                <span className="badge badge-info">2 con reserva de horas libres</span>
              </div>
              <div className="card">
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Equipos Registrados</p>
                <p className="stat-num">{equipos.length}</p>
                <span className="badge badge-success">Inventario Operativo</span>
              </div>
              <div className="card">
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Reservas Registradas</p>
                <p className="stat-num">{reservas.length}</p>
                <span className="badge badge-warning">Activas y Auditoría</span>
              </div>
            </div>

            <div className="card">
              <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '14px' }}>Accesos Rápidos</h2>
              <div style={{ display: 'flex', gap: '14px' }}>
                <button className="btn btn-primary" onClick={() => setActiveTab('reservar')}>
                  <CalendarCheck size={18} aria-hidden="true" /> Reservar Hora Libre
                </button>
                <button className="btn btn-outline" onClick={() => setActiveTab('reglamentos')}>
                  <BookOpen size={18} aria-hidden="true" /> Consultar Reglamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: LABORATORIOS */}
        {activeTab === 'laboratorios' && (
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '20px', lineHeight: 1.3 }}>Laboratorios de la Facultad</h1>
            <div className="grid-cols-2">
              {laboratorios.map(lab => (
                <div key={lab.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>{lab.nombre}</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '12px' }}>Escuela: {lab.escuela}</p>
                    </div>
                    {lab.permite_reserva ? (
                      <span className="badge badge-success">Reservable</span>
                    ) : (
                      <span className="badge badge-warning">Solo Consulta</span>
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', display: 'flex', gap: '10px' }}>
                    {lab.permite_reserva ? (
                      <button type="button" className="btn btn-primary btn-table-action" onClick={() => { setSelectedLabId(lab.id); setActiveTab('reservar'); }}>
                        Ver Disponibilidad
                      </button>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No admite reservas individuales de estudiantes</span>
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
            <div style={{ marginBottom: '20px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 700, margin: 0 }}>Disponibilidad y Creación de Reservas</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Consulta horas libres calculadas en tiempo real y reserva un puesto de laboratorio.
              </p>
            </div>

            <div className="card">
              <form onSubmit={handleCrearReserva}>
                {/* PASO 1: LABORATORIO Y FECHA */}
                <div className="flow-step">
                  <div className="flow-step-header">
                    <span className="flow-step-badge">1</span>
                    <div>
                      <h2 className="flow-step-title">Selección de Laboratorio y Fecha</h2>
                      <div className="flow-step-subtitle">Laboratorios habilitados para reserva individual y fecha de atención</div>
                    </div>
                  </div>

                  <div className="grid-cols-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor="select-lab">Laboratorio</label>
                      <select 
                        id="select-lab"
                        className="form-control" 
                        value={selectedLabId} 
                        onChange={(e) => {
                          setSelectedLabId(Number(e.target.value));
                          setSelectedSlot(null);
                        }}
                      >
                        {laboratorios.map(l => (
                          <option key={l.id} value={l.id} disabled={!l.permite_reserva}>
                            {l.nombre} {!l.permite_reserva ? '(Solo consulta)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="fecha-reserva">Fecha de Reserva</label>
                      <input 
                        id="fecha-reserva"
                        type="date" 
                        className="form-control" 
                        value={selectedFecha} 
                        min={getTodayLima()}
                        onChange={(e) => {
                          setSelectedFecha(e.target.value);
                          setSelectedSlot(null);
                        }} 
                      />
                      <div className="quick-date-container">
                        <button 
                          type="button" 
                          className={`quick-date-btn ${selectedFecha === getTodayLima() ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedFecha(getTodayLima());
                            setSelectedSlot(null);
                          }}
                        >
                          Hoy
                        </button>
                        <button 
                          type="button" 
                          className={`quick-date-btn ${selectedFecha === getTomorrowLima() ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedFecha(getTomorrowLima());
                            setSelectedSlot(null);
                          }}
                        >
                          Mañana
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PASO 2: HORAS LIBRES DISPONIBLES */}
                <div className="flow-step">
                  <div className="flow-step-header">
                    <span className="flow-step-badge">2</span>
                    <div>
                      <h2 className="flow-step-title">Bloques de Horas Libres Disponibles</h2>
                      <div className="flow-step-subtitle">
                        Horas libres calculadas en tiempo real para la fecha seleccionada
                      </div>
                    </div>
                  </div>

                  {loading && !disponibilidad ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <Loader2 size={16} className="animate-spin" /> Consultando disponibilidad en tiempo real...
                    </div>
                  ) : disponibilidad?.error ? (
                    <p style={{ color: 'var(--danger)', fontSize: '13px', margin: '8px 0' }}>{disponibilidad.error}</p>
                  ) : disponibilidad?.horas_libres && disponibilidad.horas_libres.length > 0 ? (
                    <div>
                      <div className="timeline-container" role="group" aria-label="Horas libres disponibles">
                        {disponibilidad.horas_libres.map((franja, i) => {
                          const isSelected = selectedSlot === franja;
                          return (
                            <button
                              key={i}
                              type="button"
                              className={`slot-pill ${isSelected ? 'active' : ''}`}
                              onClick={() => handleSelectSlot(franja)}
                              aria-pressed={isSelected}
                              title="Seleccionar esta franja para configurar horario"
                            >
                              <Clock size={14} />
                              <span>{franja}</span>
                              {isSelected && <Check size={14} style={{ marginLeft: '4px' }} />}
                            </button>
                          );
                        })}
                      </div>

                      {selectedSlot && (
                        <div style={{ marginTop: '16px', background: 'var(--bg-main)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                            Ajustar Horario dentro del Bloque: <span style={{ color: 'var(--primary-light)' }}>{selectedSlot}</span>
                          </h3>
                          
                          {/* Duration Chips */}
                          <div className="duration-container">
                            <button 
                              type="button" 
                              className={`duration-chip ${durationMode === 'full' ? 'active' : ''}`}
                              onClick={() => handleSelectDuration('full')}
                            >
                              Bloque completo ({selectedSlot})
                            </button>
                            <button 
                              type="button" 
                              className={`duration-chip ${durationMode === '1h' ? 'active' : ''}`}
                              onClick={() => handleSelectDuration('1h')}
                            >
                              1 hora ({selectedSlot.split(' a ')[0]} a {minToHHMM(Math.min(timeToMin(selectedSlot.split(' a ')[0]) + 60, timeToMin(selectedSlot.split(' a ')[1])) )})
                            </button>
                            {timeToMin(selectedSlot.split(' a ')[1]) - timeToMin(selectedSlot.split(' a ')[0]) >= 120 && (
                              <button 
                                type="button" 
                                className={`duration-chip ${durationMode === '2h' ? 'active' : ''}`}
                                onClick={() => handleSelectDuration('2h')}
                              >
                                2 horas ({selectedSlot.split(' a ')[0]} a {minToHHMM(Math.min(timeToMin(selectedSlot.split(' a ')[0]) + 120, timeToMin(selectedSlot.split(' a ')[1])) )})
                              </button>
                            )}
                            <button 
                              type="button" 
                              className={`duration-chip ${durationMode === 'custom' ? 'active' : ''}`}
                              onClick={() => handleSelectDuration('custom')}
                            >
                              Personalizado
                            </button>
                          </div>

                          {/* Bounded Select Dropdowns */}
                          <div className="grid-cols-2">
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" htmlFor="hora-inicio">Hora Inicio</label>
                              <select 
                                id="hora-inicio"
                                className="form-control"
                                value={formReserva.horaInicio}
                                onChange={(e) => {
                                  const newIni = e.target.value;
                                  const startM = timeToMin(newIni);
                                  const endM = timeToMin(formReserva.horaFin);
                                  const slotEndM = timeToMin(selectedSlot.split(' a ')[1]);
                                  let newFin = formReserva.horaFin;
                                  if (!formReserva.horaFin || endM <= startM || endM > slotEndM) {
                                    newFin = minToHHMM(Math.min(startM + 60, slotEndM));
                                  }
                                  setDurationMode('custom');
                                  setFormReserva(prev => ({ ...prev, horaInicio: newIni, horaFin: newFin }));
                                }}
                              >
                                {getAvailableStartTimes(selectedSlot).map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" htmlFor="hora-fin">Hora Fin</label>
                              <select 
                                id="hora-fin"
                                className="form-control"
                                value={formReserva.horaFin}
                                onChange={(e) => {
                                  setDurationMode('custom');
                                  setFormReserva(prev => ({ ...prev, horaFin: e.target.value }));
                                }}
                              >
                                {getAvailableEndTimes(selectedSlot, formReserva.horaInicio).map(t => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-subtle)', fontSize: '13px', margin: '8px 0' }}>
                      {disponibilidad?.nota || 'No hay bloques libres para este día.'}
                    </p>
                  )}
                  {clientErrors.slot && <span className="form-inline-error" role="alert">{clientErrors.slot}</span>}
                  {clientErrors.horario && <span className="form-inline-error" role="alert">{clientErrors.horario}</span>}
                </div>

                {/* PASO 3: DATOS DEL ESTUDIANTE Y CONFIRMACIÓN */}
                <div className="flow-step">
                  <div className="flow-step-header">
                    <span className="flow-step-badge">3</span>
                    <div>
                      <h2 className="flow-step-title">Datos del Estudiante y Confirmación</h2>
                      <div className="flow-step-subtitle">Tu código universitario valida la titularidad de la reserva (los campos con * son obligatorios)</div>
                    </div>
                  </div>

                  {perfilGuardado && (
                    <div className="saved-profile-bar">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserCheck size={16} />
                        <span>Datos recordados en este equipo: <strong>{formReserva.codigoEstudiante}</strong> ({formReserva.nombre})</span>
                      </div>
                      <button 
                        type="button" 
                        style={{ background: 'transparent', border: 'none', color: 'var(--success-text)', cursor: 'pointer', textDecoration: 'underline', fontSize: '12px', fontWeight: 600 }}
                        onClick={() => {
                          try {
                            localStorage.removeItem('urp_reserva_estudiante');
                          } catch (e) {}
                          setPerfilGuardado(false);
                          setFormReserva(prev => ({ ...prev, codigoEstudiante: '', nombre: '', correo: '' }));
                        }}
                      >
                        Limpiar datos
                      </button>
                    </div>
                  )}

                  <div className="grid-cols-3">
                    <div className="form-group">
                      <label className="form-label" htmlFor="codigo-estudiante">
                        Código Estudiante<span className="required-mark" aria-hidden="true">*</span>
                      </label>
                      <input 
                        id="codigo-estudiante"
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={10}
                        placeholder="202311373" 
                        className="form-control" 
                        value={formReserva.codigoEstudiante} 
                        onChange={(e) => setFormReserva({ ...formReserva, codigoEstudiante: e.target.value.replace(/\D/g, '') })} 
                        required 
                      />
                      {clientErrors.codigo && <span className="form-inline-error" role="alert">{clientErrors.codigo}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="nombre-estudiante">
                        Nombres y Apellidos<span className="required-mark" aria-hidden="true">*</span>
                      </label>
                      <input 
                        id="nombre-estudiante"
                        type="text" 
                        placeholder="Josué Córdova" 
                        className="form-control" 
                        value={formReserva.nombre} 
                        onChange={(e) => setFormReserva({ ...formReserva, nombre: e.target.value })} 
                        required 
                      />
                      {clientErrors.nombre && <span className="form-inline-error" role="alert">{clientErrors.nombre}</span>}
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="correo-estudiante">
                        Correo Institucional<span className="required-mark" aria-hidden="true">*</span>
                      </label>
                      <input 
                        id="correo-estudiante"
                        type="email" 
                        placeholder="estudiante@urp.edu.pe" 
                        className="form-control" 
                        value={formReserva.correo} 
                        onChange={(e) => setFormReserva({ ...formReserva, correo: e.target.value })} 
                        required 
                      />
                      {clientErrors.correo && <span className="form-inline-error" role="alert">{clientErrors.correo}</span>}
                    </div>
                  </div>

                  {/* Callout Requisitos URP (Arts. 20 y 28) */}
                  <div className="callout-requisitos">
                    <div className="callout-requisitos-header">
                      <ShieldCheck size={18} color="var(--primary-light)" aria-hidden="true" />
                      <span>Requisitos Obligatorios de Ingreso (Reglamento URP)</span>
                    </div>
                    <ul className="callout-requisitos-list">
                      <li><strong>Art. 28 inc. a:</strong> Presentación obligatoria del <strong>Carné Universitario físico vigente</strong> al encargado.</li>
                      <li><strong>Art. 28 inc. c:</strong> Registro obligatorio de firma en la <strong>Ficha de Control de Asistencia</strong>.</li>
                      <li><strong>Art. 20:</strong> Prohibido estrictamente ingresar con <strong>alimentos o bebidas</strong> al laboratorio.</li>
                      <li><strong>Art. 17:</strong> Tolerancia máxima de 15 minutos; transcurrido el tiempo, el puesto queda liberado.</li>
                    </ul>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      disabled={loading || !selectedSlot}
                      style={{ padding: '12px 24px', fontSize: '15px' }}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" /> Registrando Reserva...
                        </>
                      ) : (
                        <>
                          <CalendarCheck size={18} /> Confirmar Reserva
                        </>
                      )}
                    </button>
                    {!selectedSlot && (
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        Selecciona primero un bloque de horas libres arriba para habilitar la confirmación.
                      </span>
                    )}
                  </div>
                </div>
              </form>

              {/* Mensajes de respuesta */}
              {reservaResultado && (
                <div style={{ marginTop: '24px', padding: '18px', borderRadius: '8px', background: reservaResultado.ok ? 'var(--success-soft)' : 'var(--danger-soft)', border: `1px solid ${reservaResultado.ok ? 'var(--success-border)' : 'var(--danger-border)'}` }}>
                  {reservaResultado.ok ? (
                    <div>
                      <h3 style={{ color: 'var(--success-text)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', margin: 0 }}>
                        <CheckCircle2 size={20} /> ¡Reserva Confirmada Exitosamente! (N.º {reservaResultado.reserva_id})
                      </h3>
                      <p style={{ fontSize: '14px', marginTop: '8px', color: 'var(--success-text)' }}>
                        Se ha reservado un puesto para <strong>{reservaResultado.estudiante}</strong> en <strong>{reservaResultado.laboratorio}</strong> para el <strong>{selectedFecha}</strong> de <strong>{reservaResultado.hora_inicio} a {reservaResultado.hora_fin}</strong>.
                      </p>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: 'var(--success-text)', background: 'var(--success-bg)', padding: '4px 10px', borderRadius: '9999px', fontWeight: 600 }}>
                          {reservaResultado.correo_estado === 'enviado'
                            ? `✓ Comprobante enviado al correo institucional (${reservaResultado.correo_destinatario})`
                            : `✓ Comprobante registrado para ${reservaResultado.correo_destinatario}`}
                        </span>
                        <button 
                          type="button" 
                          className="btn btn-outline" 
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                          onClick={() => {
                            setBuscarCodigo(reservaResultado.codigo_estudiante || formReserva.codigoEstudiante);
                            setActiveTab('mis-reservas');
                          }}
                        >
                          Ver en Mis Reservas
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 style={{ color: 'var(--danger-text)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', margin: 0 }}>
                        <AlertCircle size={20} /> Rechazo de Reserva por Validación
                      </h3>
                      <p style={{ fontSize: '14px', marginTop: '8px', color: 'var(--danger-text)' }}>{reservaResultado.motivo}</p>
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
            <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '20px', lineHeight: 1.3 }}>Mis Reservas y Cancelación</h1>
            <div className="card">
              <div style={{ display: 'flex', gap: '12px', maxWidth: '480px' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ingresa tu código de estudiante (ej. 202311373)"
                  aria-label="Código de estudiante para consultar reservas"
                  value={buscarCodigo}
                  onChange={(e) => setBuscarCodigo(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleBuscarMisReservas} disabled={loading}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar
                </button>
              </div>

              <div style={{ marginTop: '24px' }}>
                {misReservas.length > 0 ? (
                  <div className="table-responsive">
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>
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
                          <tr key={r.id} style={{ borderBottom: '1px solid var(--surface-subtle)', fontSize: '14px' }}>
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
                                  type="button"
                                  className="btn btn-danger btn-table-action" 
                                  onClick={() => handleCancelarReserva(r.id)}
                                >
                                  <Trash2 size={14} aria-hidden="true" /> Cancelar
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-subtle)' }}>
                    <Clock size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                      Consulta tus reservas vigentes
                    </p>
                    <p style={{ fontSize: '13px', lineHeight: 1.6, maxWidth: '340px', margin: '0 auto' }}>
                      Ingresa tu código universitario arriba para revisar tus reservas o cancelar una fecha que no podrás utilizar.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VISTA 5: INVENTARIO */}
        {activeTab === 'equipos' && (
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '20px', lineHeight: 1.3 }}>Inventario de Equipos</h1>
            <div className="card">
              <div className="table-responsive">
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <th style={{ padding: '10px' }}>Código</th>
                      <th style={{ padding: '10px' }}>Equipo</th>
                      <th style={{ padding: '10px' }}>Laboratorio</th>
                      <th style={{ padding: '10px' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.map(eq => (
                      <tr key={eq.id} style={{ borderBottom: '1px solid var(--surface-subtle)', fontSize: '14px' }}>
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
          </div>
        )}

        {/* VISTA 6: REGLAMENTOS (RAG) */}
        {activeTab === 'reglamentos' && (
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, marginBottom: '20px', lineHeight: 1.3 }}>Reglamentos y Manuales</h1>
            <div className="card">
              <form onSubmit={handleBuscarReglamento} style={{ display: 'flex', gap: '12px', maxWidth: '640px' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: minutos de tolerancia, carné universitario, alimentos..."
                  aria-label="Buscar en reglamentos y manuales de laboratorio"
                  value={queryReglamento}
                  onChange={(e) => setQueryReglamento(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Consultar
                </button>
              </form>

              {/* Chips de consultas frecuentes */}
              <div className="query-chips-row" style={{ marginTop: '12px' }}>
                {[
                  { label: '⏱️ Tolerancia de ingreso (Art. 17)', q: '¿Cuántos minutos de tolerancia hay para ingresar al laboratorio?' },
                  { label: '🪪 Carné universitario (Art. 28)', q: '¿Es obligatorio presentar el carné universitario?' },
                  { label: '🚫 Alimentos y bebidas (Art. 20)', q: '¿Está permitido ingresar con alimentos o bebidas?' },
                  { label: '⚠️ Cuidado de equipos (Art. 31)', q: '¿Qué responsabilidad tiene el estudiante sobre los equipos?' },
                ].map(({ label, q }) => (
                  <button
                    key={label}
                    type="button"
                    className={`query-chip ${queryReglamento === q ? 'active' : ''}`}
                    onClick={() => setQueryReglamento(q)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: '24px' }}>
                {resultadosRAG.map((item, i) => (
                  <div key={i} style={{ padding: '16px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span className="badge badge-info">{item.cita}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Lab: {item.laboratorio}</span>
                    </div>
                    <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                      {item.texto}
                    </p>
                  </div>
                ))}
                {resultadosRAG.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-subtle)' }}>
                    <BookOpen size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 6px' }}>
                      Consulta el Reglamento de Laboratorios URP
                    </p>
                    <p style={{ fontSize: '13px', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto' }}>
                      Escribe tu pregunta en lenguaje natural o selecciona uno de los temas frecuentes para ver los artículos relevantes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Widget flotante del Asistente IA */}
      <Suspense fallback={null}>
        <ChatWidget />
      </Suspense>
    </div>
  );
}

export default App;
