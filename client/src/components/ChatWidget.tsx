import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  MessageSquare, 
  X, 
  Send, 
  Sparkles, 
  RotateCcw, 
  Bot, 
  User, 
  Minus, 
  PanelRightClose, 
  PanelRightOpen 
} from 'lucide-react';
import { api } from '../api/client';

interface ChatWidgetProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  docked: boolean;
  setDocked: (docked: boolean) => void;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  open,
  setOpen,
  docked,
  setDocked
}) => {
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

  const chatContent = (
    <>
      {/* Header Institucional */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-emerald-700/50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-700/60 border border-emerald-400/40 flex items-center justify-center shadow-inner">
            <Bot size={18} className="text-emerald-200" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-xs sm:text-sm tracking-wide text-white">Asistente Labs URP</h3>
              <Sparkles size={13} className="text-emerald-300" />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-medium text-emerald-200/90">Gemini IA · Activo</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {/* Reiniciar chat */}
          <button
            type="button"
            onClick={() => setMessages([{
              role: 'assistant',
              content: '¡Hola! Soy el **Asistente IA de los Laboratorios de la URP** 🏛️\n\nPuedo ayudarte a consultar reglamentos y normas de seguridad, revisar horas libres o registrar tu reserva de práctica libre.'
            }])}
            className="p-1.5 hover:bg-emerald-800/80 rounded-lg text-emerald-200 hover:text-white transition-colors"
            title="Reiniciar conversación"
          >
            <RotateCcw size={15} />
          </button>

          {/* Toggle Acoplar / Flotante (Solo visible en pantallas grandes) */}
          <button
            type="button"
            onClick={() => setDocked(!docked)}
            className="hidden lg:inline-flex p-1.5 hover:bg-emerald-800/80 rounded-lg text-emerald-200 hover:text-white transition-colors"
            title={docked ? "Hacer ventana flotante" : "Acoplar al lateral"}
          >
            {docked ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
          </button>

          {/* Minimizar */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 hover:bg-emerald-800/80 rounded-lg text-emerald-200 hover:text-white transition-colors"
            title="Minimizar"
          >
            <Minus size={15} />
          </button>

          {/* Cerrar */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 hover:bg-emerald-800/80 rounded-lg text-emerald-200 hover:text-white transition-colors"
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Área de Mensajes */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/70 text-slate-800 text-xs sm:text-sm">
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                  <Bot size={13} />
                </div>
              )}

              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[12px] sm:text-[13px] leading-relaxed shadow-xs ${
                  isUser
                    ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white rounded-br-xs font-normal whitespace-pre-wrap'
                    : 'bg-white text-slate-700 border border-slate-200/80 rounded-bl-xs prose prose-xs max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-slate-800'
                }`}
              >
                {isUser ? m.content : (
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                )}
              </div>

              {isUser && (
                <div className="w-6 h-6 rounded-lg bg-emerald-800 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <User size={13} />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-2 justify-start items-center">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
              <Bot size={13} />
            </div>
            <div className="bg-white border border-slate-200/80 px-3 py-2 rounded-2xl rounded-bl-xs shadow-xs flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-bounce [animation-delay:0.4s]"></div>
              <span className="text-[11px] text-slate-400 font-medium ml-1">Consultando sistema...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Píldoras de sugerencias rápidas (cuando solo está el saludo) */}
      {messages.length === 1 && (
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-1.5 shrink-0">
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
      <form onSubmit={handleSend} className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta o solicita reservar..."
          disabled={loading}
          className="flex-1 bg-slate-100 hover:bg-slate-100/80 focus:bg-white text-slate-800 text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-transparent focus:border-emerald-500 focus:outline-none transition-all placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md shadow-emerald-700/20 transition-all shrink-0"
        >
          <Send size={15} />
        </button>
      </form>
    </>
  );

  return (
    <>
      {/* Botón Flotante (FAB) -> Se muestra ÚNICAMENTE cuando el chat está CERRADO */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 h-12 px-4 rounded-full bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-700/30 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2.5 z-40 group border border-emerald-400/30"
          title="Abrir Asistente Virtual Labs URP"
        >
          <div className="relative">
            <MessageSquare size={19} />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
          </div>
          <span className="text-xs font-bold tracking-wide">Asistente IA</span>
        </button>
      )}

      {/* Ventana de Chat Abierta */}
      {open && (
        docked ? (
          /* MODO ACOPLADO LATERAL (Panel derecho en Desktop, deslizable en Mobile) */
          <aside className="fixed top-0 right-0 bottom-0 w-[380px] max-w-[90vw] bg-white border-l border-slate-200/90 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
            {chatContent}
          </aside>
        ) : (
          /* MODO FLOTANTE (Anclado limpiamente a la esquina inferior derecha) */
          <div className="fixed bottom-5 right-4 sm:right-6 w-[92vw] sm:w-[370px] h-[520px] max-h-[calc(100vh-5rem)] bg-white rounded-2xl shadow-2xl shadow-slate-900/20 flex flex-col overflow-hidden z-50 border border-slate-200/80 animate-in fade-in slide-in-from-bottom-5 duration-200">
            {chatContent}
          </div>
        )
      )}
    </>
  );
};
