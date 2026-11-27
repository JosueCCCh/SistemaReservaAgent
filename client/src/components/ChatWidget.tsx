import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Sparkles, RotateCcw } from 'lucide-react';
import { api } from '../api/client';

export const ChatWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy el Asistente IA de los Laboratorios de la URP. Puedo informarte sobre reglamentos, consultar horas libres o ayudarte a reservar un laboratorio.'
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
    } catch (err) {
      setMessages([...newHistory, { role: 'assistant', content: 'Lo siento, ocurrió un error al comunicarme con el asistente.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="chat-fab"
        onClick={() => setOpen(!open)}
        title={open ? 'Cerrar Asistente IA' : 'Hablar con el Asistente IA'}
        aria-label={open ? 'Cerrar Asistente IA' : 'Abrir Asistente IA'}
        aria-expanded={open}
      >
        {open ? <X size={26} aria-hidden="true" /> : <MessageSquare size={26} aria-hidden="true" />}
      </button>

      {open && (
        <div className="chat-window" role="dialog" aria-label="Asistente Labs URP">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#38bdf8" aria-hidden="true" />
              <span style={{ fontWeight: 600 }}>Asistente Labs URP</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', minWidth: '32px', minHeight: '32px', justifyContent: 'center' }}
                title="Reiniciar conversación" 
                aria-label="Reiniciar conversación"
                onClick={() => setMessages([{
                  role: 'assistant',
                  content: '¡Hola! Soy el Asistente IA de los Laboratorios de la URP. Puedo informarte sobre reglamentos, consultar horas libres o ayudarte a reservar un laboratorio.'
                }])}
              >
                <RotateCcw size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', minWidth: '32px', minHeight: '32px', justifyContent: 'center' }}
                title="Cerrar asistente"
                aria-label="Cerrar asistente"
                onClick={() => setOpen(false)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`message-bubble ${m.role === 'user' ? 'message-user' : 'message-assistant'}`}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="message-bubble message-assistant" style={{ fontStyle: 'italic', color: '#64748b' }}>
                Consultando disponibilidad y reglamentos URP...
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div style={{ padding: '0 4px', marginTop: '4px' }}>
                <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>Consultas frecuentes:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <button 
                    type="button" 
                    className="query-chip" 
                    style={{ textAlign: 'left', width: 'fit-content' }}
                    onClick={() => {
                      setInput('¿Cuáles son los requisitos para ingresar a los laboratorios?');
                    }}
                  >
                    ¿Cuáles son los requisitos de ingreso?
                  </button>
                  <button 
                    type="button" 
                    className="query-chip" 
                    style={{ textAlign: 'left', width: 'fit-content' }}
                    onClick={() => {
                      setInput('¿Cuántos minutos de tolerancia hay para entrar al laboratorio?');
                    }}
                  >
                    ¿Cuánta tolerancia hay para ingresar?
                  </button>
                  <button 
                    type="button" 
                    className="query-chip" 
                    style={{ textAlign: 'left', width: 'fit-content' }}
                    onClick={() => {
                      setInput('¿Qué laboratorios admiten reservas de horas libres?');
                    }}
                  >
                    ¿Qué laboratorios admiten reservas?
                  </button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={handleSend}>
            <input
              type="text"
              className="form-control"
              placeholder="Escribe tu consulta..."
              aria-label="Escribe tu consulta para el asistente"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 14px' }} disabled={loading} aria-label="Enviar mensaje">
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
