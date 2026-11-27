import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { db, initSchema } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { apiRouter } from './routes/api.routes.js';

const app = express();

app.use(cors());
app.use(express.json());

// Inicializar esquema de SQLite y auto-poblar si está vacía
initSchema();
const count = (db.prepare('SELECT COUNT(*) as c FROM laboratorios').get() as any)?.c || 0;
if (count === 0) {
  console.log('🌱 Base de datos vacía. Ejecutando auto-seed inicial...');
  seedDatabase();
}

// Rutas de API
app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${config.port}`);
  console.log(`📡 Endpoints API disponibles en http://localhost:${config.port}/api`);
});
