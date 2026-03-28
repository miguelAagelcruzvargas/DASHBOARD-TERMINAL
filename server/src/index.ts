import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth';
import expensesRouter from './routes/expenses';
import healthRouter from './routes/health';
import settingsRouter from './routes/settings';
import tripsRouter from './routes/trips';
import ticketsRouter from './routes/tickets';
import { ensureDatabaseSchema } from './lib/db';

dotenv.config();

const app = express();
const port = Number.parseInt(process.env.API_PORT ?? '8787', 10);

app.use(cors({ origin: true }));
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(express.json({ limit: '1mb' }));

app.use('/api', healthRouter);
app.use('/api', authRouter);
app.use('/api', settingsRouter);
app.use('/api', tripsRouter);
app.use('/api', ticketsRouter);
app.use('/api', expensesRouter);

async function startServer() {
  await ensureDatabaseSchema();
  app.listen(port, () => {
    console.log(`Terminal AU API listening on port ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});
