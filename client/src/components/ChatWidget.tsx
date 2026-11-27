import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Sparkles, RotateCcw, Bot, User } from 'lucide-react';
import { api } from '../api/client';

export const ChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy el **Asistente IA de los Laboratorios de la URP** 🏛️\n\nPuedo ayudarte a consultar reglamentos y normas de seguridad, revisar horas libres o registrar tu reserva de práctica libre.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    const previousHistory = [...messages];
    const newHistory = [...messages, { role: 'user' as const, content: userText }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const res = await api.enviarChat(userText, previousHistory);
      setMessages([...newHistory, { role: 'assistant', content: res.respuesta }]);
    } catch {
      setMessages([...newHistory, { role: 'assistant', content: 'Lo siento, ocurrió un error al comunicarme con el asistente de laboratorios.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón Flotante (FAB) con efecto Glow y animación */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500 text-white shadow-xl shadow-emerald-700/30 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center z-50 group border border-emerald-400/30"
        title="Asistente Virtual Labs URP"
      >
        {open ? (
          <X size={24} className="transition-transform group-hover:rotate-90 duration-200" />
        ) : (
          <div className="relative">
            <MessageSquare size={26} />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
          </div>
        )}
      </button>

      {/* Ventana de Chat Flotante */}
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 w-[92vw] sm:w-[410px] h-[560px] max-h-[80vh] bg-white rounded-2xl shadow-2xl shadow-slate-900/20 flex flex-col overflow-hidden z-50 border border-slate-200/80 animate-in fade-in slide-in-from-bottom-6 duration-200">
          
          {/* Header Institucional */}
          <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-700/50">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-700/60 border border-emerald-400/40 flex items-center justify-center shadow-inner">
                <Bot size={20} className="text-emerald-200" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm tracking-wide text-white">Asistente Labs URP</h3>
                  <Sparkles size={14} className="text-emerald-300" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[11px] font-medium text-emerald-200/90">Gemini IA · Activo</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMessages([{
                  role: 'assistant',
                  content: '¡Hola! Soy el **Asistente IA de los Laboratorios de la URP** 🏛️\n\nPuedo ayudarte a consultar reglamentos y normas de seguridad, revisar horas libres o registrar tu reserva de práctica libre.'
                }])}
                className="p-1.5 hover:bg-emerald-800/80 rounded-lg text-emerald-200 hover:text-white transition-colors"
                title="Reiniciar conversación"
              >
                <RotateCcw size={16} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-emerald-800/80 rounded-lg text-emerald-200 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70 text-slate-800 text-sm">
            {messages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <div key={i} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                      <Bot size={15} />
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap ${
                      isUser
                        ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white rounded-br-xs font-normal'
                        : 'bg-white text-slate-700 border border-slate-200/80 rounded-bl-xs'
                    }`}
                  >
                    {m.content}
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <User size={15} />
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-2.5 justify-start items-center">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                  <Bot size={15} />
                </div>
                <div className="bg-white border border-slate-200/80 px-4 py-3 rounded-2xl rounded-bl-xs shadow-sm flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]"></div>
                  <span className="text-xs text-slate-400 font-medium ml-1">Consultando sistema...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Pills (when only initial message is shown) */}
          {messages.length === 1 && (
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-1.5">
              {[
                '¿Qué laboratorios puedo reservar?',
                '¿Horas libres para hoy?',
                '¿Cuál es la tolerancia de ingreso?'
              ].map((sugerencia, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInput(sugerencia);
                  }}
                  className="text-[11px] font-medium bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-800 border border-slate-200/80 hover:border-emerald-300 rounded-lg px-2.5 py-1 transition-all"
                >
                  {sugerencia}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Haz una pregunta o solicita reservar..."
              disabled={loading}
              className="flex-1 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-sm px-4 py-2.5 rounded-xl border border-transparent focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-emerald-700/20 transition-all shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
