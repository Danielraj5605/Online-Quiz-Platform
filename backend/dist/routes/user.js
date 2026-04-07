"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// Current user's results history
router.get('/results', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const results = await db_1.default.result.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { quiz: { select: { title: true } } },
        });
        res.json(results);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Current user's stats
router.get('/stats', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [totalResults, aggregate] = await Promise.all([
            db_1.default.result.count({ where: { userId } }),
            db_1.default.result.aggregate({
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
