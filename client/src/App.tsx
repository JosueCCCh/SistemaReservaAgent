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
  Trash2,
  Menu,
  X,
  Cpu,
  Radio,
  Cog,
  ArrowRight,
  Info,
  Sparkles
} from 'lucide-react';
import { api } from './api/client';
import type { Laboratorio, Equipo, Reserva, DisponibilidadResponse, FragmentoCita } from './api/client';
import { ChatWidget } from './components/ChatWidget';

export function App() {
  const [activeTab, setActiveTab] = useState<'inicio' | 'laboratorios' | 'reservar' | 'mis-reservas' | 'equipos' | 'reglamentos'>('laboratorios');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDocked, setChatDocked] = useState(false);

  // Estados generales
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
  const [buscarCodigo, setBuscarCodigo] = useState('202311373');
  const [misReservas, setMisReservas] = useState<Reserva[]>([]);

  // Estados de reglamentos (RAG)
  const [queryReglamento, setQueryReglamento] = useState('');
  const [resultadosRAG, setResultadosRAG] = useState<FragmentoCita[]>([]);

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
      if (buscarCodigo) {
        const mis = await api.getReservas(buscarCodigo);
        setMisReservas(mis);
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  // Función para obtener icono temático según el laboratorio
  const getLabIcon = (nombre: string) => {
    if (nombre.includes('Circuitos')) return <Cpu className="w-6 h-6 text-emerald-600" />;
    if (nombre.includes('Digitales')) return <Cpu className="w-6 h-6 text-teal-600" />;
    if (nombre.includes('Telecomunicaciones')) return <Radio className="w-6 h-6 text-sky-600" />;
    if (nombre.includes('CIM')) return <Cog className="w-6 h-6 text-amber-600" />;
    return <Wrench className="w-6 h-6 text-indigo-600" />;
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* Sidebar Institucional URP */}
      <aside 
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-gradient-to-b from-emerald-950 via-slate-900 to-slate-950 text-white flex flex-col transition-transform duration-300 ease-in-out border-r border-emerald-900/40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-6 border-b border-emerald-800/30 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-900/40 flex items-center justify-center">
              <div className="w-full h-full bg-emerald-950 rounded-[14px] flex items-center justify-center font-black text-emerald-300 text-lg tracking-wider">
                URP
              </div>
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-white tracking-tight">Laboratorios URP</h1>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-400">Facultad de Ingeniería</span>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {[
            { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
            { id: 'laboratorios', label: 'Laboratorios', icon: Building2 },
            { id: 'reservar', label: 'Disponibilidad y Reserva', icon: CalendarCheck },
            { id: 'mis-reservas', label: 'Mis Reservas', icon: Clock },
            { id: 'equipos', label: 'Inventario de Equipos', icon: Wrench },
            { id: 'reglamentos', label: 'Reglamentos (RAG)', icon: BookOpen }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-900/30 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Icon size={19} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-emerald-400 transition-colors'} />
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute right-3 w-1.5 h-5 rounded-full bg-emerald-300"></span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card / Info */}
        <div className="p-4 m-4 rounded-xl bg-emerald-900/20 border border-emerald-700/30 flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <div className="text-xs">
            <p className="font-semibold text-emerald-200">Zona Horaria Oficial</p>
            <p className="text-slate-400 text-[11px]">Lima (UTC-5)</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300 ${chatOpen && chatDocked ? 'lg:mr-[380px]' : ''}`}>
        {/* Topbar Institucional */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              <Menu size={20} />
            </button>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 hidden sm:inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Sistema de Gestión y Prácticas Libres
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                chatOpen 
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100'
              }`}
            >
              <Sparkles size={14} />
              <span className="hidden sm:inline">Asistente IA</span>
            </button>

            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-800">Universidad Ricardo Palma</p>
              <p className="text-[11px] text-slate-400">Campus Central · Surco</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm border border-emerald-200">
              JC
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-8 bg-slate-50/80">
          <div className="max-w-5xl xl:max-w-6xl mx-auto space-y-7 pb-16">
            
            {/* VISTA 1: INICIO */}
            {activeTab === 'inicio' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Panel de Control General</h2>
                  <p className="text-sm text-slate-500 mt-1">Resumen en tiempo real del estado de los laboratorios y reservas.</p>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Laboratorios</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-2">{laboratorios.length}</h3>
                      </div>
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                        <Building2 size={22} />
                      </div>
                    </div>
                    <span className="inline-flex mt-4 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      2 Habilitados para Horas Libres
                    </span>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Equipos en Inventario</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-2">{equipos.length}</h3>
                      </div>
                      <div className="p-3 bg-teal-50 text-teal-700 rounded-xl">
                        <Wrench size={22} />
                      </div>
                    </div>
                    <span className="inline-flex mt-4 text-xs font-medium px-2.5 py-1 rounded-full bg-teal-100 text-teal-800">
                      Disponibles para Prácticas
                    </span>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Reservas en Base de Datos</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-2">{reservas.length}</h3>
                      </div>
                      <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                        <CalendarCheck size={22} />
                      </div>
                    </div>
                    <span className="inline-flex mt-4 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                      Gestión Concurrente SQLite
                    </span>
                  </div>
                </div>

                {/* Banner de Acceso Rápido */}
                <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-950/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                  <div>
                    <h3 className="text-xl font-bold">¿Necesitas realizar una práctica libre hoy?</h3>
                    <p className="text-emerald-200 text-sm mt-1 max-w-xl">
                      Consulta la disponibilidad en tiempo real o habla con el Asistente IA para reservar en Circuitos y Dispositivos o Sistemas Digitales.
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('reservar')}
                    className="px-5 py-3 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 font-bold text-sm shadow-md transition-all flex items-center gap-2 active:scale-95 shrink-0"
                  >
                    <span>Reservar Ahora</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* VISTA 2: LABORATORIOS (REDISEÑADA PREMIUM) */}
            {activeTab === 'laboratorios' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Laboratorios de la Facultad</h2>
                    <p className="text-sm text-slate-500 mt-1">Directorio de ambientes académicos, horarios oficiales y capacidades de reserva.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 shadow-xs">
                      5 Ambientes Registrados
                    </span>
                  </div>
                </div>

                {/* Grid de Cards de Laboratorio */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {laboratorios.map(lab => {
                    const icon = getLabIcon(lab.nombre);
                    const isReservable = Boolean(lab.permite_reserva);

                    return (
                      <div 
                        key={lab.id} 
                        className={`bg-white rounded-2xl border transition-all duration-200 p-6 flex flex-col justify-between hover:shadow-lg ${
                          isReservable 
                            ? 'border-emerald-200/80 hover:border-emerald-400 shadow-sm' 
                            : 'border-slate-200/70 hover:border-slate-300 shadow-xs'
                        }`}
                      >
                        <div>
                          {/* Top Row con Icono y Badge */}
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className={`p-3 rounded-xl border ${
                              isReservable 
                                ? 'bg-emerald-50/80 border-emerald-200' 
                                : 'bg-slate-100/80 border-slate-200'
                            }`}>
                              {icon}
                            </div>
                            
                            {isReservable ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                Reservable
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Solo Consulta
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg font-bold text-slate-900">{lab.nombre}</h3>
                          <p className="text-xs font-medium text-emerald-700 mt-0.5">Escuela Académica: {lab.escuela}</p>
                          
                          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                            {isReservable
                              ? 'Ambiente equipado con estaciones de trabajo habilitadas para horas de práctica libre bajo el Art. 28 de la URP.'
                              : 'Ambiente de uso docente exclusivo para el desarrollo de clases teóricas y experimentales. Solo consulta de normas e inventario.'}
                          </p>
                        </div>

                        {/* Botón / Footer */}
                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                          {isReservable ? (
                            <button
                              onClick={() => {
                                setSelectedLabId(lab.id);
                                setActiveTab('reservar');
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-semibold text-xs tracking-wide shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all active:scale-98"
                            >
                              <CalendarCheck size={16} />
                              <span>Consultar Horas y Reservar</span>
                            </button>
                          ) : (
                            <div className="w-full py-2.5 px-4 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-500 font-medium text-xs text-center flex items-center justify-center gap-1.5">
                              <Info size={14} className="text-slate-400" />
                              <span>No contempla reservas individuales</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* VISTA 3: DISPONIBILIDAD Y RESERVA */}
            {activeTab === 'reservar' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Disponibilidad y Creación de Reservas</h2>
                  <p className="text-sm text-slate-500 mt-1">Selecciona el laboratorio y fecha para consultar y reservar tu bloque de horas libres.</p>
                </div>

                {/* Filtro Selector */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Laboratorio</label>
                      <select 
                        value={selectedLabId} 
                        onChange={(e) => setSelectedLabId(Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl px-4 py-2.5 focus:bg-white focus:border-emerald-600 focus:outline-none transition-colors"
                      >
                        {laboratorios.map(l => (
                          <option key={l.id} value={l.id} disabled={!l.permite_reserva}>
                            {l.nombre} {!l.permite_reserva ? '(Solo consulta)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Fecha de Reserva</label>
                      <input 
                        type="date"
                        value={selectedFecha}
                        onChange={(e) => setSelectedFecha(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold rounded-xl px-4 py-2.5 focus:bg-white focus:border-emerald-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* Franjas Libres Interactivas */}
                  <div className="mt-6 pt-5 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
                      Franjas libres disponibles para el {selectedFecha}:
                    </p>

                    {disponibilidad?.error ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>{disponibilidad.error}</span>
                      </div>
                    ) : disponibilidad?.horas_libres && disponibilidad.horas_libres.length > 0 ? (
                      <div className="flex flex-wrap gap-2.5">
                        {disponibilidad.horas_libres.map((franja, i) => {
                          const [ini, fin] = franja.split(' a ');
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setFormReserva({ ...formReserva, horaInicio: ini, horaFin: fin })}
                              className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 font-semibold text-xs transition-all active:scale-95 shadow-xs flex items-center gap-1.5"
                              title="Haz clic para autocompletar horario"
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <span>{franja}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 font-medium">
                        {disponibilidad?.nota || 'No hay franjas libres disponibles para este día.'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Formulario de Registro */}
                <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs">
                  <h3 className="text-base font-bold text-slate-900 mb-5">Confirmar Datos del Alumno</h3>
                  
                  <form onSubmit={handleCrearReserva} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Hora Inicio (HH:MM)</label>
                        <input 
                          type="text" 
                          placeholder="08:00" 
                          value={formReserva.horaInicio} 
                          onChange={(e) => setFormReserva({ ...formReserva, horaInicio: e.target.value })} 
                          required 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Hora Fin (HH:MM)</label>
                        <input 
                          type="text" 
                          placeholder="10:00" 
                          value={formReserva.horaFin} 
                          onChange={(e) => setFormReserva({ ...formReserva, horaFin: e.target.value })} 
                          required 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Código Universitario</label>
                        <input 
                          type="text" 
                          placeholder="202311373" 
                          value={formReserva.codigoEstudiante} 
                          onChange={(e) => setFormReserva({ ...formReserva, codigoEstudiante: e.target.value })} 
                          required 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nombres y Apellidos</label>
                        <input 
                          type="text" 
                          placeholder="Josué Córdova" 
                          value={formReserva.nombre} 
                          onChange={(e) => setFormReserva({ ...formReserva, nombre: e.target.value })} 
                          required 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Correo Electrónico Oficial (Gmail / URP)</label>
                        <input 
                          type="email" 
                          placeholder="estudiante@urp.edu.pe" 
                          value={formReserva.correo} 
                          onChange={(e) => setFormReserva({ ...formReserva, correo: e.target.value })} 
                          required 
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-emerald-600 focus:outline-none"
                        />
                        <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                          <Info size={13} className="text-emerald-600 shrink-0" />
                          <span>Se enviará la constancia y detalles oficiales de la reserva a este correo.</span>
                        </p>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={loading}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-bold text-sm tracking-wide shadow-md shadow-emerald-700/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {loading ? 'Validando...' : 'Confirmar y Guardar Reserva'}
                    </button>
                  </form>

                  {/* Feedback Box */}
                  {reservaResultado && (
                    <div className={`mt-6 p-4 rounded-xl border ${
                      reservaResultado.ok 
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-900' 
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}>
                      {reservaResultado.ok ? (
                        <div className="space-y-1 text-xs">
                          <p className="font-bold text-sm flex items-center gap-1.5 text-emerald-800">
                            <CheckCircle2 size={18} /> ¡Reserva Registrada Exitosamente! (N.º {reservaResultado.reserva_id})
                          </p>
                          <p>Estudiante: <strong>{reservaResultado.estudiante}</strong> | Horario: <strong>{reservaResultado.hora_inicio} a {reservaResultado.hora_fin}</strong></p>
                          <p>Confirmación oficial enviada a: <strong>{reservaResultado.correo_destinatario}</strong></p>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 text-xs">
                          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-sm text-rose-800">No se pudo procesar la reserva</p>
                            <p className="mt-0.5">{reservaResultado.motivo}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VISTA 4: MIS RESERVAS */}
            {activeTab === 'mis-reservas' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Mis Reservas y Cancelación</h2>
                  <p className="text-sm text-slate-500 mt-1">Consulta las reservas asociadas a tu código universitario y cancélalas si es necesario.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                  <div className="flex flex-col sm:flex-row gap-3 max-w-md">
                    <input 
                      type="text" 
                      placeholder="Código universitario (ej. 202311373)"
                      value={buscarCodigo}
                      onChange={(e) => setBuscarCodigo(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-emerald-600 focus:outline-none"
                    />
                    <button 
                      onClick={handleBuscarMisReservas}
                      className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                    >
                      <Search size={16} /> Buscar
                    </button>
                  </div>

                  <div className="mt-6 overflow-x-auto">
                    {misReservas.length > 0 ? (
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <th className="py-3 px-3">N.º</th>
                            <th className="py-3 px-3">Laboratorio</th>
                            <th className="py-3 px-3">Fecha</th>
                            <th className="py-3 px-3">Horario</th>
                            <th className="py-3 px-3">Estado</th>
                            <th className="py-3 px-3">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {misReservas.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3.5 px-3 font-semibold text-slate-700">#{r.id}</td>
                              <td className="py-3.5 px-3 font-medium text-slate-900">{r.laboratorio_nombre}</td>
                              <td className="py-3.5 px-3 text-slate-600">{r.fecha}</td>
                              <td className="py-3.5 px-3 font-medium text-slate-800">{r.hora_inicio} a {r.hora_fin}</td>
                              <td className="py-3.5 px-3">
                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                  r.estado === 'activa' 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}>
                                  {r.estado}
                                </span>
                              </td>
                              <td className="py-3.5 px-3">
                                {r.estado === 'activa' && (
                                  <button
                                    onClick={() => handleCancelarReserva(r.id)}
                                    className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 rounded-lg transition-colors"
                                    title="Cancelar Reserva"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-xs text-slate-400 py-6 text-center">No hay reservas registradas para este código.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 5: INVENTARIO */}
            {activeTab === 'equipos' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Inventario de Equipos</h2>
                  <p className="text-sm text-slate-500 mt-1">Instrumentación y módulos disponibles por laboratorio.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-3">Código</th>
                        <th className="py-3 px-3">Equipo</th>
                        <th className="py-3 px-3">Laboratorio</th>
                        <th className="py-3 px-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {equipos.map(eq => (
                        <tr key={eq.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-3 font-bold text-slate-700">{eq.codigo}</td>
                          <td className="py-3.5 px-3 font-medium text-slate-900">{eq.nombre}</td>
                          <td className="py-3.5 px-3 text-slate-600">{eq.laboratorio_nombre}</td>
                          <td className="py-3.5 px-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              eq.estado === 'operativo'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
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
              <div className="space-y-6 animate-in fade-in duration-200">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Reglamentos y Manuales (RAG FTS5)</h2>
                  <p className="text-sm text-slate-500 mt-1">Búsqueda textual indexada sobre las normativas de laboratorios de la URP.</p>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                  <form onSubmit={handleBuscarReglamento} className="flex gap-3 max-w-xl">
                    <input 
                      type="text"
                      placeholder="Ej: minutos de tolerancia, carné universitario, alimentos..."
                      value={queryReglamento}
                      onChange={(e) => setQueryReglamento(e.target.value)}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:bg-white focus:border-emerald-600 focus:outline-none"
                    />
                    <button 
                      type="submit"
                      className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm flex items-center gap-2 shadow-xs transition-all active:scale-95"
                    >
                      <Search size={16} /> Consultar
                    </button>
                  </form>

                  <div className="mt-6 space-y-4">
                    {resultadosRAG.map((item, i) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-800 px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-200">
                            {item.cita}
                          </span>
                          <span className="text-slate-400 font-medium">Lab: {item.laboratorio}</span>
                        </div>
                        <p className="text-slate-700 text-sm leading-relaxed">{item.texto}</p>
                      </div>
                    ))}
                    {resultadosRAG.length === 0 && (
                      <p className="text-xs text-slate-400 py-6 text-center">Ingresa una consulta para buscar artículos en los reglamentos de la facultad.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Chatbot Flotante / Acoplado IA */}
      <ChatWidget 
        open={chatOpen} 
        setOpen={setChatOpen} 
        docked={chatDocked} 
        setDocked={setChatDocked} 
      />
    </div>
  );
}

export default App;
