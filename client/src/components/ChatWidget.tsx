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
      <div className="chat-fab" onClick={() => setOpen(!open)} title="Hablar con el Asistente IA">
        {open ? <X size={26} /> : <MessageSquare size={26} />}
      </div>

      {open && (
        <div className="chat-window">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#38bdf8" />
              <span style={{ fontWeight: 600 }}>Asistente Labs URP</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button 
                type="button"
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Reiniciar conversación" 
                onClick={() => setMessages([{
                  role: 'assistant',
                  content: '¡Hola! Soy el Asistente IA de los Laboratorios de la URP. Puedo informarte sobre reglamentos, consultar horas libres o ayudarte a reservar un laboratorio.'
                }])}
              >
                <RotateCcw size={16} />
              </button>
              <X size={20} style={{ cursor: 'pointer' }} onClick={() => setOpen(false)} />
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
                Pensando y consultando herramientas...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-area" onSubmit={handleSend}>
            <input
              type="text"
              className="form-control"
              placeholder="Escribe tu consulta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 14px' }} disabled={loading}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
