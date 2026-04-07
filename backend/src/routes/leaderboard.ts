import { Router } from 'express';
import prisma from '../db';

const router = Router();

// Global leaderboard (top 20 by score percentage, then time)
router.get('/', async (_req, res) => {
  try {
    const top = await prisma.result.findMany({
      orderBy: [{ score: 'desc' }, { timeTaken: 'asc' }, { createdAt: 'asc' }],
      take: 20,
      include: { user: { select: { username: true } }, quiz: { select: { title: true } } },
    });
    res.json(top);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
