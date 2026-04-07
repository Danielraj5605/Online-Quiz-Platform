import { Router } from 'express';
import prisma from '../db';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// List users
router.get('/users', authenticate, requireAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { quizzes: true, results: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List quizzes with stats
router.get('/quizzes', authenticate, requireAdmin, async (_req, res) => {
  try {
    const quizzes = await prisma.quiz.findMany({
      include: {
        creator: { select: { username: true } },
        _count: { select: { questions: true, results: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(quizzes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Basic analytics
router.get('/analytics', authenticate, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const [users, quizzes, results, attempts] = await Promise.all([
      prisma.user.count(),
      prisma.quiz.count(),
      prisma.result.count(),
      prisma.attempt.count(),
    ]);

    const topQuizzes = await prisma.result.groupBy({
      by: ['quizId'],
      _count: { quizId: true },
      orderBy: { _count: { quizId: 'desc' } },
      take: 5,
    });

    res.json({ totals: { users, quizzes, results, attempts }, topQuizzes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
