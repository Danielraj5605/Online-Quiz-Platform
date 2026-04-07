import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../db';

const router = Router();

// Current user's results history
router.get('/results', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const results = await prisma.result.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { quiz: { select: { title: true } } },
    });
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Current user's stats
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const [totalResults, aggregate] = await Promise.all([
      prisma.result.count({ where: { userId } }),
      prisma.result.aggregate({
        _sum: { score: true, total: true },
        _avg: { score: true },
        where: { userId },
      }),
    ]);

    res.json({
      totalAttempts: totalResults,
      totalScore: aggregate._sum.score ?? 0,
      totalPossible: aggregate._sum.total ?? 0,
      avgScore: aggregate._avg.score ?? 0,
      averagePercent: aggregate._sum.total ? Math.round(((aggregate._sum.score ?? 0) / (aggregate._sum.total ?? 1)) * 100) : 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
