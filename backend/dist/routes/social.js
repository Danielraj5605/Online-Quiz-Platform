"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const zod_1 = require("zod");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// Validation schemas
const reviewSchema = zod_1.z.object({
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().max(500).optional(),
});
// ============== Badges & XP Routes ==============
// Get user's badges
router.get('/badges', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userBadges = await db_1.default.userBadge.findMany({
            where: { userId },
            include: { badge: true },
            orderBy: { earnedAt: 'desc' },
        });
        res.json(userBadges);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all available badges
router.get('/badges/available', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const userBadges = await db_1.default.userBadge.findMany({ where: { userId } });
        const earnedBadgeIds = userBadges.map((ub) => ub.badgeId);
        const availableBadges = await db_1.default.badge.findMany({
            where: { id: { notIn: earnedBadgeIds } },
        });
        res.json(availableBadges);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user XP and tier info
router.get('/xp', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await db_1.default.user.findUnique({
            where: { id: userId },
            select: { xp: true, tier: true },
        });
        res.json(user);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get leaderboard by XP
router.get('/leaderboard/xp', async (req, res) => {
    try {
        const topUsers = await db_1.default.user.findMany({
            orderBy: { xp: 'desc' },
            take: 20,
            select: { id: true, username: true, avatar: true, xp: true, tier: true },
        });
        res.json(topUsers);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============== Follow Routes ==============
// Helper to parse userId from params
const parseUserId = (userId) => {
    if (!userId)
        return 0;
    return parseInt(Array.isArray(userId) ? userId[0] : userId);
};
// Helper to parse quizId from params
const parseQuizId = (quizId) => {
    if (!quizId)
        return 0;
    return parseInt(Array.isArray(quizId) ? quizId[0] : quizId);
};
// Follow a user
router.post('/follow/:userId', auth_1.authenticate, async (req, res) => {
    try {
        const followerId = req.user.userId;
        const followingId = parseUserId(req.params.userId);
        if (followerId === followingId) {
            res.status(400).json({ error: 'Cannot follow yourself' });
            return;
        }
        const userToFollow = await db_1.default.user.findUnique({ where: { id: followingId } });
        if (!userToFollow) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        // Check if already following
        const existing = await db_1.default.follow.findUnique({
            where: { followerId_followingId: { followerId, followingId } },
        });
        if (existing) {
            res.status(400).json({ error: 'Already following this user' });
            return;
        }
        await db_1.default.follow.create({
            data: { followerId, followingId },
        });
        res.json({ message: 'Followed successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Unfollow a user
router.delete('/follow/:userId', auth_1.authenticate, async (req, res) => {
    try {
        const followerId = req.user.userId;
        const followingId = parseUserId(req.params.userId);
        await db_1.default.follow.delete({
            where: { followerId_followingId: { followerId, followingId } },
        });
        res.json({ message: 'Unfollowed successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user's followers
router.get('/followers/:userId', async (req, res) => {
    try {
        const userId = parseUserId(req.params.userId);
        const followers = await db_1.default.follow.findMany({
            where: { followingId: userId },
            include: { follower: { select: { id: true, username: true, avatar: true } } },
        });
        res.json(followers.map((f) => f.follower));
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user's following
router.get('/following/:userId', async (req, res) => {
    try {
        const userId = parseUserId(req.params.userId);
        const following = await db_1.default.follow.findMany({
            where: { followerId: userId },
            include: { following: { select: { id: true, username: true, avatar: true } } },
        });
        res.json(following.map((f) => f.following));
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Check if following a user
router.get('/follow/:userId/status', auth_1.authenticate, async (req, res) => {
    try {
        const followerId = req.user.userId;
        const followingId = parseUserId(req.params.userId);
        const existing = await db_1.default.follow.findUnique({
            where: { followerId_followingId: { followerId, followingId } },
        });
        res.json({ isFollowing: !!existing });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============== Review Routes ==============
// Get reviews for a quiz
router.get('/quiz/:quizId/reviews', async (req, res) => {
    try {
        const quizId = parseQuizId(req.params.quizId);
        const reviews = await db_1.default.review.findMany({
            where: { quizId },
            include: { user: { select: { id: true, username: true, avatar: true } } },
            orderBy: { createdAt: 'desc' },
        });
        res.json(reviews);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get average rating for a quiz
router.get('/quiz/:quizId/rating', async (req, res) => {
    try {
        const quizId = parseQuizId(req.params.quizId);
        const result = await db_1.default.review.aggregate({
            where: { quizId },
            _avg: { rating: true },
            _count: { rating: true },
        });
        res.json({
            average: result._avg.rating || 0,
            count: result._count.rating || 0,
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create or update review
router.post('/quiz/:quizId/review', auth_1.authenticate, (0, validate_1.validateBody)(reviewSchema), async (req, res) => {
    try {
        const userId = req.user.userId;
        const quizId = parseQuizId(req.params.quizId);
        const { rating, comment } = req.body;
        const quiz = await db_1.default.quiz.findUnique({ where: { id: quizId } });
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        // Check if already reviewed
        const existing = await db_1.default.review.findUnique({
            where: { userId_quizId: { userId, quizId } },
        });
        if (existing) {
            const updated = await db_1.default.review.update({
                where: { id: existing.id },
                data: { rating, comment },
                include: { user: { select: { id: true, username: true, avatar: true } } },
            });
            res.json(updated);
        }
        else {
            const review = await db_1.default.review.create({
                data: { userId, quizId, rating, comment },
                include: { user: { select: { id: true, username: true, avatar: true } } },
            });
            res.status(201).json(review);
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete review
router.delete('/quiz/:quizId/review', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const quizId = parseQuizId(req.params.quizId);
        await db_1.default.review.delete({
            where: { userId_quizId: { userId, quizId } },
        });
        res.json({ message: 'Review deleted' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============== Daily Challenge Routes ==============
// Get today's challenge
router.get('/challenge/daily', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let challenge = await db_1.default.dailyChallenge.findUnique({
            where: { date: today },
        });
        if (!challenge) {
            // Get a random quiz as today's challenge
            const randomQuiz = await db_1.default.quiz.findFirst({
                where: { isPublished: true },
                orderBy: { results: { _count: 'desc' } },
            });
            if (randomQuiz) {
                challenge = await db_1.default.dailyChallenge.create({
                    data: {
                        date: today,
                        quizId: randomQuiz.id,
                        xpBonus: 200,
                    },
                });
            }
        }
        if (!challenge) {
            res.status(404).json({ error: 'No challenge available today' });
            return;
        }
        const quiz = await db_1.default.quiz.findUnique({
            where: { id: challenge.quizId },
            select: { id: true, title: true, category: true, difficulty: true, _count: { select: { questions: true } } },
        });
        res.json({ ...challenge, quiz });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get user's challenge history
router.get('/challenge/history', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const challenges = await db_1.default.dailyChallenge.findMany({
            orderBy: { date: 'desc' },
            take: 30,
        });
        // Check which ones the user completed
        const userResults = await db_1.default.result.findMany({
            where: {
                userId,
                quizId: { in: challenges.map((c) => c.quizId) },
            },
            select: { quizId: true },
        });
        const completedQuizIds = new Set(userResults.map((r) => r.quizId));
        res.json(challenges.map((c) => ({
            ...c,
            completed: completedQuizIds.has(c.quizId),
        })));
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============== Share Routes ==============
// Generate shareable result link
router.get('/share/result/:resultId', auth_1.authenticate, async (req, res) => {
    try {
        const resultId = parseInt(req.params.resultId);
        const result = await db_1.default.result.findUnique({
            where: { id: resultId },
            include: {
                user: { select: { username: true } },
                quiz: { select: { title: true } },
            },
        });
        if (!result) {
            res.status(404).json({ error: 'Result not found' });
            return;
        }
        // Generate share data (in production, this could be a short URL)
        const shareData = {
            username: result.user.username,
            quizTitle: result.quiz.title,
            score: result.score,
            total: result.total,
            percentage: Math.round((result.score / result.total) * 100),
            tier: req.user?.role || 'User',
        };
        res.json(shareData);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
