import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'reservas.db'),
  timeZone: process.env.TZ || 'America/Lima',
  mail: {
    mode: (process.env.MAIL_MODE || 'simulado') as 'simulado' | 'real',
    from: process.env.MAIL_FROM || '',
    appPassword: (process.env.MAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
    allowedDomains: process.env.ALLOWED_EMAIL_DOMAINS 
      ? process.env.ALLOWED_EMAIL_DOMAINS.split(',').map(d => d.trim().toLowerCase()) 
      : []
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  }
};
