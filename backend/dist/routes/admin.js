"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// List users
router.get('/users', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    try {
        const users = await db_1.default.user.findMany({
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// List quizzes with stats
router.get('/quizzes', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    try {
        const quizzes = await db_1.default.quiz.findMany({
            include: {
                creator: { select: { username: true } },
                _count: { select: { questions: true, results: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(quizzes);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Basic analytics
router.get('/analytics', auth_1.authenticate, auth_1.requireAdmin, async (_req, res) => {
    try {
        const [users, quizzes, results, attempts] = await Promise.all([
            db_1.default.user.count(),
            db_1.default.quiz.count(),
            db_1.default.result.count(),
            db_1.default.attempt.count(),
        ]);
        const topQuizzes = await db_1.default.result.groupBy({
            by: ['quizId'],
            _count: { quizId: true },
            orderBy: { _count: { quizId: 'desc' } },
            take: 5,
        });
        res.json({ totals: { users, quizzes, results, attempts }, topQuizzes });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
