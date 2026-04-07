"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const auth_2 = require("../middleware/auth");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// All analytics routes require admin
router.use(auth_1.authenticate, auth_2.requireAdmin);
// ============== Overview Analytics ==============
// Get platform overview stats
router.get('/overview', async (req, res) => {
    try {
        const [totalUsers, totalQuizzes, totalResults, totalAttempts, recentUsers, recentQuizzes, recentResults,] = await Promise.all([
            db_1.default.user.count(),
            db_1.default.quiz.count(),
            db_1.default.result.count(),
            db_1.default.attempt.count({ where: { status: 'COMPLETED' } }),
            db_1.default.user.count({
                where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            }),
            db_1.default.quiz.count({
                where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            }),
            db_1.default.result.count({
                where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            }),
        ]);
        // Calculate growth percentages
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const [usersLastWeek, quizzesLastWeek, resultsLastWeek,] = await Promise.all([
            db_1.default.user.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
            db_1.default.quiz.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
            db_1.default.result.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
        ]);
        const userGrowth = usersLastWeek > 0 ? Math.round(((recentUsers - usersLastWeek) / usersLastWeek) * 100) : 0;
        const quizGrowth = quizzesLastWeek > 0 ? Math.round(((recentQuizzes - quizzesLastWeek) / quizzesLastWeek) * 100) : 0;
        const resultGrowth = resultsLastWeek > 0 ? Math.round(((recentResults - resultsLastWeek) / resultsLastWeek) * 100) : 0;
        // Average score
        const avgScoreResult = await db_1.default.result.aggregate({
            _avg: { score: true },
        });
        // Active users today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const activeUsersToday = await db_1.default.attempt.findMany({
            where: { startedAt: { gte: todayStart }, status: 'COMPLETED' },
            distinct: ['userId'],
            select: { userId: true },
        });
        res.json({
            totals: {
                users: totalUsers,
                quizzes: totalQuizzes,
                results: totalResults,
                attempts: totalAttempts,
            },
            recent: {
                users: recentUsers,
                quizzes: recentQuizzes,
                results: recentResults,
            },
            growth: {
                users: userGrowth,
                quizzes: quizGrowth,
                results: resultGrowth,
            },
            averageScore: Math.round((avgScoreResult._avg.score || 0) * 100) / 100,
            activeUsersToday: activeUsersToday.length,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============== Quiz Analytics ==============
// Get detailed quiz analytics
router.get('/quiz/:id', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id);
        const quiz = await db_1.default.quiz.findUnique({
            where: { id: quizId },
            include: {
                creator: { select: { username: true } },
                questions: {
                    include: {
                        options: true,
                        responses: true,
                    },
                },
                results: true,
            },
        });
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        // Calculate stats
        const totalAttempts = quiz.results.length;
        const avgScore = totalAttempts > 0
            ? quiz.results.reduce((sum, r) => sum + r.score, 0) / totalAttempts
            : 0;
        const avgTime = totalAttempts > 0
            ? quiz.results.reduce((sum, r) => sum + r.timeTaken, 0) / totalAttempts
            : 0;
        // Per-question analytics
        const questionAnalytics = quiz.questions.map((q) => {
            const responses = q.responses;
            const timesShown = responses.length;
            const timesCorrect = responses.filter((r) => {
                const option = q.options.find((o) => o.id === r.optionId);
                return option?.isCorrect;
            }).length;
            const successRate = timesShown > 0 ? (timesCorrect / timesShown) * 100 : 0;
            // Answer distribution
            const answerDistribution = q.options.map((o) => ({
                optionId: o.id,
                text: o.text,
                isCorrect: o.isCorrect,
                timesSelected: responses.filter((r) => r.optionId === o.id).length,
                percentage: timesShown > 0 ? Math.round((responses.filter((r) => r.optionId === o.id).length / timesShown) * 100) : 0,
            }));
            return {
                questionId: q.id,
                text: q.text,
                type: q.type,
                timesShown,
                timesCorrect,
                successRate: Math.round(successRate * 100) / 100,
                difficulty: successRate > 70 ? 'Easy' : successRate > 40 ? 'Medium' : 'Hard',
                answerDistribution,
            };
        });
        // Score distribution
        const scoreDistribution = {
            excellent: quiz.results.filter((r) => (r.score / r.total) >= 0.8).length,
            good: quiz.results.filter((r) => (r.score / r.total) >= 0.6 && (r.score / r.total) < 0.8).length,
            fair: quiz.results.filter((r) => (r.score / r.total) >= 0.4 && (r.score / r.total) < 0.6).length,
            poor: quiz.results.filter((r) => (r.score / r.total) < 0.4).length,
        };
        // Time-based trends (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const dailyStats = await db_1.default.result.groupBy({
            by: ['createdAt'],
            where: {
                quizId,
                createdAt: { gte: thirtyDaysAgo },
            },
            _count: true,
            _avg: { score: true },
        });
        res.json({
            quiz: {
                id: quiz.id,
                title: quiz.title,
                creator: quiz.creator.username,
                createdAt: quiz.createdAt,
            },
            stats: {
                totalAttempts,
                avgScore: Math.round(avgScore * 100) / 100,
                avgTime: Math.round(avgTime),
                completionRate: quiz.results.length > 0 ? Math.round((quiz.results.length / (quiz.results.length + 1)) * 100) : 0,
            },
            scoreDistribution,
            questionAnalytics,
            dailyTrends: dailyStats.map((d) => ({
                date: d.createdAt,
                attempts: d._count,
                avgScore: Math.round((d._avg.score || 0) * 100) / 100,
            })),
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============== User Analytics ==============
// Get user activity analytics
router.get('/users', async (req, res) => {
    try {
        const { page = '1', limit = '20', sort = 'recent' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const orderBy = sort === 'xp'
            ? { xp: 'desc' }
            : sort === 'results'
                ? { results: { _count: 'desc' } }
                : { createdAt: 'desc' };
        const [users, total] = await Promise.all([
            db_1.default.user.findMany({
                skip,
                take: parseInt(limit),
                orderBy,
                select: {
                    id: true,
                    username: true,
                    email: true,
                    role: true,
                    xp: true,
                    tier: true,
                    createdAt: true,
                    _count: {
                        select: {
                            results: true,
                            quizzes: true,
                            badges: true,
                        },
                    },
                },
            }),
            db_1.default.user.count(),
        ]);
        res.json({
            users: users.map((u) => ({
                ...u,
                resultCount: u._count.results,
                quizCount: u._count.quizzes,
                badgeCount: u._count.badges,
                _count: undefined,
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get detailed user analytics
router.get('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await db_1.default.user.findUnique({
            where: { id: userId },
            include: {
                results: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        quiz: { select: { title: true, category: true } },
                    },
                },
                badges: {
                    include: { badge: true },
                },
                following: { select: { followingId: true } },
                followers: { select: { followerId: true } },
            },
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Calculate stats
        const totalQuizzes = user.results.length;
        const avgScore = totalQuizzes > 0
            ? user.results.reduce((sum, r) => sum + (r.score / r.total) * 100, 0) / totalQuizzes
            : 0;
        const totalTime = user.results.reduce((sum, r) => sum + r.timeTaken, 0);
        // Category breakdown
        const categoryStats = user.results.reduce((acc, r) => {
            const cat = r.quiz.category || 'Uncategorized';
            if (!acc[cat])
                acc[cat] = { count: 0, totalScore: 0 };
            acc[cat].count++;
            acc[cat].totalScore += (r.score / r.total) * 100;
            return acc;
        }, {});
        const categoryBreakdown = Object.entries(categoryStats).map(([category, stats]) => ({
            category,
            quizzes: stats.count,
            avgScore: Math.round(stats.totalScore / stats.count),
        }));
        // Daily activity (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const dailyActivity = await db_1.default.result.groupBy({
            by: ['createdAt'],
            where: { userId, createdAt: { gte: thirtyDaysAgo } },
            _count: true,
        });
        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                xp: user.xp,
                tier: user.tier,
                createdAt: user.createdAt,
            },
            stats: {
                totalQuizzes,
                avgScore: Math.round(avgScore),
                totalTime,
                perfectScores: user.results.filter((r) => r.score === r.total).length,
            },
            categoryBreakdown,
            recentResults: user.results,
            badges: user.badges,
            social: {
                following: user.following.length,
                followers: user.followers.length,
            },
            dailyActivity: dailyActivity.map((d) => ({
                date: d.createdAt,
                quizzes: d._count,
            })),
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============== Moderation ==============
// Get flagged content queue
router.get('/moderation', async (req, res) => {
    try {
        const { status = 'PENDING', page = '1', limit = '20' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [flagged, total] = await Promise.all([
            db_1.default.flaggedContent.findMany({
                where: { status: status },
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
            }),
            db_1.default.flaggedContent.count({ where: { status: status } }),
        ]);
        res.json({
            flagged,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Resolve flagged content
router.put('/moderation/:id', async (req, res) => {
    try {
        const flagId = parseInt(req.params.id);
        const { action, notes } = req.body; // action: 'DISMISS' | 'REMOVE_CONTENT'
        const flagged = await db_1.default.flaggedContent.findUnique({ where: { id: flagId } });
        if (!flagged) {
            res.status(404).json({ error: 'Flag not found' });
            return;
        }
        // Update flag status
        await db_1.default.flaggedContent.update({
            where: { id: flagId },
            data: {
                status: action === 'DISMISS' ? 'DISMISSED' : 'REVIEWED',
                reviewedBy: req.user.userId,
                reviewedAt: new Date(),
                notes,
            },
        });
        // If action is REMOVE_CONTENT, delete the content
        if (action === 'REMOVE_CONTENT') {
            if (flagged.contentType === 'QUIZ') {
                await db_1.default.quiz.delete({ where: { id: flagged.contentId } });
            }
            else if (flagged.contentType === 'QUESTION') {
                await db_1.default.question.delete({ where: { id: flagged.contentId } });
            }
            // For USER, you'd typically ban or suspend instead
        }
        res.json({ message: 'Flag resolved successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============== Audit Log ==============
// Get audit log
router.get('/audit-log', async (req, res) => {
    try {
        const { page = '1', limit = '50', action, userId } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const where = {};
        if (action)
            where.action = action;
        if (userId)
            where.userId = parseInt(userId);
        const [logs, total] = await Promise.all([
            db_1.default.auditLog.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
            }),
            db_1.default.auditLog.count({ where }),
        ]);
        res.json({
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============== System Health ==============
// Get system health metrics
router.get('/health', async (req, res) => {
    try {
        const now = new Date();
        const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const [requestsLastHour, resultsLastHour, activeAttempts,] = await Promise.all([
            db_1.default.auditLog.count({ where: { createdAt: { gte: hourAgo } } }),
            db_1.default.result.count({ where: { createdAt: { gte: hourAgo } } }),
            db_1.default.attempt.count({ where: { status: 'ACTIVE' } }),
        ]);
        // Database size estimation (rough)
        const userCount = await db_1.default.user.count();
        const quizCount = await db_1.default.quiz.count();
        const resultCount = await db_1.default.result.count();
        res.json({
            status: 'healthy',
            timestamp: now,
            metrics: {
                requestsPerHour: requestsLastHour,
                completionsPerHour: resultsLastHour,
                activeSessions: activeAttempts,
                totalRecords: {
                    users: userCount,
                    quizzes: quizCount,
                    results: resultCount,
                },
            },
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
