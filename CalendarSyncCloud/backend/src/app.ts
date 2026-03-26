import express from 'express';
import session from 'express-session';
import cors from 'cors';
import authRouter from './routes/auth.js';
import calendarsRouter from './routes/calendars.js';
import syncRouter from './routes/sync.js';

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use('/auth', authRouter);
app.use('/calendars', calendarsRouter);
app.use('/sync', syncRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

export default app;
