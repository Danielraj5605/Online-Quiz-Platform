import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import "dotenv/config";

import authRoutes from './routes/auth';
import quizRoutes from './routes/quiz';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';
import leaderboardRoutes from './routes/leaderboard';
import socialRoutes from './routes/social';
import analyticsRoutes from './routes/analytics';
import { requestLogger, errorLogger } from './middleware/logger';
import prisma from './db';

const app = express();
const PORT = process.env.PORT || 5000;

// Security: CORS - restrict to frontend origin in production
const corsOptions = process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL
  ? { origin: process.env.FRONTEND_URL }
  : {};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' })); // Prevent large payload attacks

// Security: Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 attempts per 15 minutes for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

app.use(globalLimiter);

// Request logging
app.use(requestLogger);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/analytics', analyticsRoutes);

// Global error handler (must be after all routes)
app.use(errorLogger);
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Final error handler:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error('Database health check failed:', error.message);
    res.status(503).json({ status: 'error', database: 'disconnected', error: error.message, timestamp: new Date().toISOString() });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
