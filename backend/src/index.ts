import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api';
import { errorHandler } from './middleware/errorHandler';
import { webSocketGateway } from './websocket/gateway';
import { offlineScheduler } from './scheduler/offlineScheduler';
import { seedDevices } from './database/seed';
import prisma from './database/prisma';

const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const OFFLINE_THRESHOLD_MS = Number(process.env.OFFLINE_THRESHOLD_MS) || 120_000;
const OFFLINE_CHECK_INTERVAL_MS =
  Number(process.env.OFFLINE_CHECK_INTERVAL_MS) || 30_000;

async function bootstrap(): Promise<void> {
  // Verify database connectivity early
  await prisma.$connect();
  await seedDevices();

  const app = express();
  app.use(cors({ origin: CORS_ORIGIN }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);
  app.use(errorHandler);

  const server = http.createServer(app);
  webSocketGateway.initialize(server, CORS_ORIGIN);

  offlineScheduler.start(OFFLINE_CHECK_INTERVAL_MS, OFFLINE_THRESHOLD_MS);

  server.listen(PORT, () => {
    console.log(`Telemetry API listening on http://localhost:${PORT}`);
    console.log(`CORS origin: ${CORS_ORIGIN}`);
  });

  const shutdown = async () => {
    console.log('Shutting down...');
    offlineScheduler.stop();
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
