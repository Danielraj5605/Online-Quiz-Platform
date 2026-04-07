"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const quiz_1 = require("../validators/quiz");
const sanitize_1 = require("../utils/sanitize");
const gamification_1 = require("../utils/gamification");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
const isOwnerOrAdmin = (userId, quizCreatorId, role) => role === 'admin' || userId === quizCreatorId;
// Validate question based on type
const validateQuestion = (q) => {
    const { type, options } = q;
    switch (type) {
        case 'TRUE_FALSE':
            // True/False must have exactly 2 options: "True" and "False"
            if (!options || options.length !== 2) {
                return 'True/False questions must have exactly 2 options';
            }
            const texts = options.map((o) => o.text.toLowerCase()).sort();
            if (texts[0] !== 'false' || texts[1] !== 'true') {
                return 'True/False options must be exactly "True" and "False"';
            }
            // Must have exactly one correct
            if (options.filter((o) => o.isCorrect).length !== 1) {
                return 'True/False questions must have exactly one correct answer';
            }
            return null;
        case 'MULTI_SELECT':
            // Multi-select must have at least 2 correct answers
            if (!options || options.filter((o) => o.isCorrect).length < 2) {
                return 'Multi-select questions must have at least 2 correct answers';
            }
            return null;
        case 'FILL_BLANK':
            // Fill in the blank doesn't need options
            return null;
        case 'MULTIPLE_CHOICE':
        default:
            // Multiple choice must have exactly 1 correct
            if (!options || options.filter((o) => o.isCorrect).length !== 1) {
                return 'Multiple choice questions must have exactly one correct answer';
            }
            return null;
    }
};
// Create a new quiz
router.post('/', auth_1.authenticate, (0, validate_1.validateBody)(quiz_1.createQuizSchema), async (req, res) => {
    try {
        const { title, description, category, timeLimit = 600, difficulty = 'medium', isPublished = true, shuffleQuestions = false, maxAttempts = null, availableFrom, availableUntil, questions } = req.body;
        const userId = req.user.userId;
        if (!title || !questions || !Array.isArray(questions)) {
            res.status(400).json({ error: 'Title and questions are required' });
            return;
        }
        // Sanitize title and description to prevent XSS
        const sanitized = (0, sanitize_1.sanitizeObject)({ title, description }, ['title', 'description']);
        // Validate questions
        for (const q of questions) {
            const error = validateQuestion(q);
            if (error) {
                res.status(400).json({ error });
                return;
            }
        }
        const quiz = await db_1.default.quiz.create({
            data: {
                title: sanitized.title || title,
                description: sanitized.description || description,
                category,
                timeLimit,
                difficulty,
                isPublished,
                shuffleQuestions,
                maxAttempts,
                availableFrom: availableFrom ? new Date(availableFrom) : null,
                availableUntil: availableUntil ? new Date(availableUntil) : null,
                creatorId: userId,
                questions: {
                    create: questions.map((q, idx) => ({
                        text: q.text,
                        order: q.order ?? idx,
                        type: q.type || 'MULTIPLE_CHOICE',
                        options: q.options ? {
                            create: q.options.map((o) => ({
                                text: o.text,
                                isCorrect: o.isCorrect,
                            })),
                        } : undefined,
                    })),
                },
            },
            include: {
                questions: { include: { options: true } },
            },
        });
        res.status(201).json(quiz);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all quizzes
router.get('/', async (_req, res) => {
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
// Get a single quiz by ID (without correct answers if taking it)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const quiz = await db_1.default.quiz.findUnique({
            where: { id: parseInt(id) },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: {
                        options: {
                            select: { id: true, text: true }, // hide isCorrect
                        },
                    },
                },
                creator: { select: { username: true } },
            },
        });
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        res.json(quiz);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update quiz
router.put('/:id', auth_1.authenticate, (0, validate_1.validateBody)(quiz_1.updateQuizSchema), async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const userId = req.user.userId;
        const role = req.user.role;
        const quiz = await db_1.default.quiz.findUnique({ where: { id: quizId } });
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        if (!isOwnerOrAdmin(userId, quiz.creatorId, role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { title, description, category, timeLimit, difficulty, isPublished } = req.body;
        // Sanitize title and description to prevent XSS
        const sanitized = (0, sanitize_1.sanitizeObject)({ title, description }, ['title', 'description']);
        const updated = await db_1.default.quiz.update({
            where: { id: quizId },
            data: {
                ...(title !== undefined && { title: sanitized.title || title }),
                ...(description !== undefined && { description: sanitized.description || description }),
                category,
                timeLimit,
                difficulty,
                isPublished,
            },
        });
        res.json(updated);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Duplicate quiz
router.post('/:id/duplicate', auth_1.authenticate, (0, validate_1.validateBody)(quiz_1.duplicateQuizSchema), async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const userId = req.user.userId;
        const role = req.user.role;
        const { newTitle } = req.body;
        const quiz = await db_1.default.quiz.findUnique({
            where: { id: quizId },
            include: {
                questions: {
                    include: { options: true },
                },
            },
        });
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        // Only owner or admin can duplicate
        if (!isOwnerOrAdmin(userId, quiz.creatorId, role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const duplicatedQuiz = await db_1.default.quiz.create({
            data: {
                title: newTitle || `${quiz.title} (Copy)`,
                description: quiz.description,
                category: quiz.category,
                difficulty: quiz.difficulty,
                timeLimit: quiz.timeLimit,
                maxAttempts: quiz.maxAttempts,
                isPublished: false, // Always unpublished on duplicate
                shuffleQuestions: quiz.shuffleQuestions,
                creatorId: userId,
                questions: {
                    create: quiz.questions.map((q, idx) => ({
                        text: q.text,
                        order: q.order ?? idx,
                        type: q.type,
                        options: {
                            create: q.options.map((o) => ({
                                text: o.text,
                                isCorrect: o.isCorrect,
                            })),
                        },
                    })),
                },
            },
            include: {
                questions: { include: { options: true } },
            },
        });
        res.status(201).json(duplicatedQuiz);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete quiz
router.delete('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const userId = req.user.userId;
        const role = req.user.role;
        const quiz = await db_1.default.quiz.findUnique({ where: { id: quizId } });
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        if (!isOwnerOrAdmin(userId, quiz.creatorId, role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        await db_1.default.quiz.delete({ where: { id: quizId } });
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add question to quiz
router.post('/:quizId/questions', auth_1.authenticate, async (req, res) => {
    try {
        const quizId = parseInt(req.params.quizId, 10);
        const { text, type = 'MULTIPLE_CHOICE', options, order = 0 } = req.body;
        if (!text) {
            res.status(400).json({ error: 'Question text is required' });
            return;
        }
        // Validate question based on type
        const validationError = validateQuestion({ type, options });
        if (validationError) {
            res.status(400).json({ error: validationError });
            return;
        }
        const quiz = await db_1.default.quiz.findUnique({ where: { id: quizId } });
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        if (!isOwnerOrAdmin(req.user.userId, quiz.creatorId, req.user.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const question = await db_1.default.question.create({
            data: {
                quizId,
                text,
                order,
                type,
                options: options ? { create: options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) } : undefined,
            },
            include: { options: true },
        });
        res.status(201).json(question);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update question
router.put('/questions/:questionId', auth_1.authenticate, async (req, res) => {
    try {
        const questionId = parseInt(req.params.questionId, 10);
        const { text, type, options, order } = req.body;
        const question = await db_1.default.question.findUnique({ where: { id: questionId }, include: { quiz: true } });
        if (!question) {
            res.status(404).json({ error: 'Question not found' });
            return;
        }
        if (!question.quiz) {
            res.status(400).json({ error: 'Cannot update global questions' });
            return;
        }
        if (!isOwnerOrAdmin(req.user.userId, question.quiz.creatorId, req.user.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        // Validate if options provided
        if (options) {
            const validationError = validateQuestion({ type: type || question.type, options });
            if (validationError) {
                res.status(400).json({ error: validationError });
                return;
            }
        }
        const updates = {};
        if (text)
            updates.text = text;
        if (order !== undefined)
            updates.order = order;
        const updated = await db_1.default.question.update({
            where: { id: questionId },
            data: updates,
        });
        if (options) {
            await db_1.default.option.deleteMany({ where: { questionId } });
            await db_1.default.option.createMany({
                data: options.map((o) => ({ questionId, text: o.text, isCorrect: o.isCorrect })),
            });
        }
        const refreshed = await db_1.default.question.findUnique({ where: { id: questionId }, include: { options: true } });
        res.json(refreshed);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete question
router.delete('/questions/:questionId', auth_1.authenticate, async (req, res) => {
    try {
        const questionId = parseInt(req.params.questionId, 10);
        const question = await db_1.default.question.findUnique({ where: { id: questionId }, include: { quiz: true } });
        if (!question) {
            res.status(404).json({ error: 'Question not found' });
            return;
        }
        if (!question.quiz) {
            res.status(400).json({ error: 'Cannot delete global questions from question bank' });
            return;
        }
        if (!isOwnerOrAdmin(req.user.userId, question.quiz.creatorId, req.user.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        await db_1.default.question.delete({ where: { id: questionId } });
        res.status(204).send();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Start quiz (creates/returns active attempt)
router.post('/:id/start', auth_1.authenticate, async (req, res) => {
    try {
        console.log('=== QUIZ START ===');
        const quizId = parseInt(req.params.id, 10);
        const userId = req.user.userId;
        const quiz = await db_1.default.quiz.findUnique({
            where: { id: quizId },
            include: {
                questions: {
                    orderBy: { order: 'asc' },
                    include: { options: { select: { id: true, text: true } } },
                },
            },
        });
        console.log('Quiz found:', quiz ? 'yes' : 'no');
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        // Check scheduled availability
        const now = new Date();
        if (quiz.availableFrom && now < quiz.availableFrom) {
            res.status(403).json({ error: 'Quiz is not available yet' });
            return;
        }
        if (quiz.availableUntil && now > quiz.availableUntil) {
            res.status(403).json({ error: 'Quiz is no longer available' });
            return;
        }
        // Check attempt limits
        if (quiz.maxAttempts !== null) {
            const completedAttempts = await db_1.default.attempt.count({
                where: { quizId, userId, status: 'COMPLETED' },
            });
            if (completedAttempts >= quiz.maxAttempts) {
                res.status(403).json({ error: `Maximum ${quiz.maxAttempts} attempts reached for this quiz` });
                return;
            }
        }
        // Try to find existing active attempt first
        let attempt = await db_1.default.attempt.findFirst({
            where: { quizId, userId, status: 'ACTIVE' },
        });
        console.log('Existing active attempt:', attempt?.id);
        if (!attempt) {
            // Generate shuffled question order if enabled
            let questionOrder = [];
            if (quiz.shuffleQuestions) {
                questionOrder = quiz.questions.map((q) => q.id).sort(() => Math.random() - 0.5);
            }
            else {
                questionOrder = quiz.questions.map((q) => q.id);
            }
            // Try to create, handle race condition if another request created one
            try {
                attempt = await db_1.default.attempt.create({
                    data: { quizId, userId, status: 'ACTIVE', questionOrder },
                });
                console.log('Created new attempt:', attempt.id);
            }
            catch (createError) {
                if (createError.code === 'P2002') {
                    // Another request created one - find it
                    attempt = await db_1.default.attempt.findFirst({
                        where: { quizId, userId, status: 'ACTIVE' },
                    });
                    console.log('Found existing after conflict:', attempt?.id);
                }
                else {
                    throw createError;
                }
            }
        }
        // Ensure we have an attempt before building the response
        if (!attempt) {
            console.error('Unable to create or fetch attempt for quiz', quizId, 'user', userId);
            res.status(500).json({ error: 'Unable to start quiz attempt' });
            return;
        }
        // Return questions in the attempt's stored order (for randomized quizzes)
        const orderedQuestions = quiz.shuffleQuestions && attempt.questionOrder.length > 0
            ? attempt.questionOrder.map((qId) => quiz.questions.find((q) => q.id === qId)).filter(Boolean)
            : quiz.questions;
        res.json({
            attemptId: attempt.id,
            startedAt: attempt.startedAt,
            timeLimit: quiz.timeLimit,
            quiz: { ...quiz, questions: orderedQuestions },
        });
    }
    catch (error) {
        console.error('Quiz start error:', error.message || error, error.code);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});
// Submit quiz answers
router.post('/:id/submit', auth_1.authenticate, (0, validate_1.validateBody)(quiz_1.submitQuizSchema), async (req, res) => {
    try {
        console.log('=== QUIZ SUBMIT START ===');
        const quizId = parseInt(req.params.id, 10);
        const { answers, attemptId, elapsedSeconds } = req.body;
        const userId = req.user.userId;
        console.log('Quiz ID:', quizId, 'Attempt ID:', attemptId, 'User ID:', userId);
        console.log('Answers:', JSON.stringify(answers));
        if (!answers || typeof answers !== 'object') {
            res.status(400).json({ error: 'Answers are required' });
            return;
        }
        const quiz = await db_1.default.quiz.findUnique({
            where: { id: quizId },
            include: { questions: { include: { options: true } } },
        });
        console.log('Quiz found:', quiz ? 'yes' : 'no', 'Questions:', quiz?.questions.length);
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        let attempt = attemptId
            ? await db_1.default.attempt.findFirst({ where: { id: attemptId, quizId, userId } })
            : await db_1.default.attempt.findFirst({ where: { quizId, userId, status: 'ACTIVE' } });
        console.log('Initial attempt found:', attempt ? attempt.id : 'null', 'status:', attempt?.status);
        // If no active attempt found, check if user has any attempt for this quiz
        // If they do (likely COMPLETED), we need to create a new ACTIVE attempt
        // This handles the case where the unique constraint is on [userId, quizId] without status
        if (!attempt) {
            console.log('No active attempt, looking for existing...');
            const existingAttempt = await db_1.default.attempt.findFirst({
                where: { quizId, userId },
                orderBy: { startedAt: 'desc' },
            });
            console.log('Existing attempt:', existingAttempt ? existingAttempt.id : 'null', 'status:', existingAttempt?.status);
            if (existingAttempt && existingAttempt.status === 'ACTIVE') {
                // Reuse the existing active attempt
                attempt = existingAttempt;
                console.log('Reusing existing active attempt:', attempt.id);
            }
            else {
                // User has a completed attempt or no attempt - try to create new active attempt
                // Use try-catch to handle race condition if another request creates one first
                try {
                    console.log('Creating new attempt...');
                    attempt = await db_1.default.attempt.create({
                        data: { quizId, userId, status: 'ACTIVE' },
                    });
                    console.log('New attempt created:', attempt.id);
                }
                catch (createError) {
                    console.log('Create failed with code:', createError.code);
                    // If create fails due to unique constraint, try to find the active attempt again
                    if (createError.code === 'P2002') {
                        attempt = await db_1.default.attempt.findFirst({
                            where: { quizId, userId, status: 'ACTIVE' },
                        });
                        console.log('Found existing active after P2002:', attempt?.id);
                        if (!attempt) {
                            // Still no active attempt - something is wrong
                            throw new Error('Could not find or create active attempt');
                        }
                    }
                    else {
                        throw createError;
                    }
                }
            }
        }
        console.log('Final attempt ID:', attempt?.id, 'status:', attempt?.status);
        if (attempt.status === 'COMPLETED') {
            res.status(400).json({ error: 'Attempt already submitted' });
            return;
        }
        let score = 0;
        const total = quiz.questions.length;
        console.log('Calculating score, total questions:', total);
        for (const question of quiz.questions) {
            const answer = answers[String(question.id)]; // Convert question ID to string since JSON keys are strings
            console.log('Question ID:', question.id, 'Answer:', answer);
            const correctOptions = question.options.filter((o) => o.isCorrect);
            switch (question.type) {
                case 'MULTI_SELECT': {
                    // Multiple correct answers - answer is array of optionIds
                    const selectedIds = Array.isArray(answer) ? answer.map(Number) : [];
                    const correctIds = correctOptions.map((o) => o.id).sort();
                    // Check if all correct options are selected and no wrong options
                    if (selectedIds.length === correctIds.length &&
                        selectedIds.every((id) => correctIds.includes(id))) {
                        score++;
                    }
                    break;
                }
                case 'FILL_BLANK': {
                    // Fill in the blank - case-insensitive string match
                    const userAnswer = (answer || '').trim().toLowerCase();
                    const correctAnswer = correctOptions[0]?.text.trim().toLowerCase();
                    if (userAnswer === correctAnswer) {
                        score++;
                    }
                    break;
                }
                case 'TRUE_FALSE':
                case 'MULTIPLE_CHOICE':
                default: {
                    // Single correct answer
                    const selectedOptionId = Number(answer);
                    const correctOption = correctOptions[0];
                    if (correctOption && selectedOptionId === correctOption.id) {
                        score++;
                    }
                    break;
                }
            }
        }
        console.log('Final score:', score, 'out of', total);
        const now = new Date();
        const timeTaken = elapsedSeconds ?? Math.max(0, Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000));
        console.log('Time taken:', timeTaken, 'seconds');
        // First, clean up any existing COMPLETED attempts for this user+quiz BEFORE transaction
        // This avoids unique constraint issues when we update our ACTIVE attempt to COMPLETED
        const existingCompletedAttempts = await db_1.default.attempt.findMany({
            where: { userId, quizId, status: 'COMPLETED' },
        });
        if (existingCompletedAttempts.length > 0) {
            console.log('Cleaning up', existingCompletedAttempts.length, 'existing COMPLETED attempts');
            for (const existing of existingCompletedAttempts) {
                await db_1.default.response.deleteMany({ where: { attemptId: existing.id } });
                await db_1.default.result.deleteMany({ where: { attemptId: existing.id } });
            }
            await db_1.default.attempt.deleteMany({
                where: { userId, quizId, status: 'COMPLETED' },
            });
        }
        // Use transaction to ensure atomicity - with timeout
        console.log('Starting transaction...');
        const result = await db_1.default.$transaction(async (tx) => {
            // Delete any existing responses for this attempt
            await tx.response.deleteMany({ where: { attemptId: attempt.id } });
            await tx.result.deleteMany({ where: { attemptId: attempt.id } });
            // Store responses - handle multi-select (array of optionIds)
            const responsesData = [];
            for (const [qid, answer] of Object.entries(answers)) {
                const questionId = parseInt(qid);
                if (Array.isArray(answer)) {
                    // Multi-select: create multiple responses
                    for (const optionId of answer) {
                        responsesData.push({
                            userId,
                            quizId,
                            questionId,
                            optionId: Number(optionId),
                            attemptId: attempt.id,
                        });
                    }
                }
                else {
                    responsesData.push({
                        userId,
                        quizId,
                        questionId,
                        optionId: Number(answer),
                        attemptId: attempt.id,
                    });
                }
            }
            if (responsesData.length > 0) {
                await tx.response.createMany({ data: responsesData });
            }
            const newResult = await tx.result.create({
                data: {
                    userId,
                    quizId,
                    score,
                    total,
                    correct: score,
                    timeTaken,
                    attemptId: attempt.id,
                },
            });
            await tx.attempt.update({
                where: { id: attempt.id },
                data: { status: 'COMPLETED', completedAt: now },
            });
            return newResult;
        }, {
            timeout: 15000, // 15 second transaction timeout
        });
        console.log('Transaction completed, result ID:', result.id);
        // Calculate XP and update user (outside transaction to avoid locks)
        console.log('Calculating XP...');
        const xpEarned = (0, gamification_1.calculateXP)(score, total, timeTaken, quiz.timeLimit);
        console.log('XP earned:', xpEarned);
        const [xpUpdate, badgeResult] = await Promise.all([
            (0, gamification_1.updateUserXP)(userId, xpEarned),
            (0, gamification_1.checkAndAwardBadges)(userId, score, total, timeTaken, quiz.timeLimit, xpEarned),
        ]);
        console.log('XP update result:', xpUpdate);
        res.json({
            score,
            total,
            correct: score,
            resultId: result.id,
            timeTaken,
            xpEarned,
            newXP: xpUpdate?.newXP,
            newTier: xpUpdate?.newTier,
            newBadges: badgeResult.newBadges,
        });
    }
    catch (error) {
        console.error('Quiz submit error:', error.message || error, error.code);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message || 'Unknown error',
            code: error.code
        });
    }
});
// Results for current user on a quiz
router.get('/:id/results', auth_1.authenticate, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const userId = req.user.userId;
        const result = await db_1.default.result.findFirst({
            where: { quizId, userId },
            orderBy: { createdAt: 'desc' },
            include: {
                attempt: true,
                quiz: { select: { title: true, timeLimit: true } },
            },
        });
        if (!result) {
            res.status(404).json({ error: 'No results found' });
            return;
        }
        const responses = await db_1.default.response.findMany({
            where: { attemptId: result.attemptId ?? undefined, userId, quizId },
            include: {
                question: { include: { options: true } },
                option: true,
            },
        });
        res.json({ result, responses });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Leaderboard
router.get('/:id/leaderboard', async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const top = await db_1.default.result.findMany({
            where: { quizId },
            orderBy: [{ score: 'desc' }, { timeTaken: 'asc' }, { createdAt: 'asc' }],
            take: 10,
            include: { user: { select: { username: true } } },
        });
        res.json(top);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// History for current user
router.get('/history/me', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const history = await db_1.default.result.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { quiz: { select: { title: true } } },
        });
        res.json(history);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ============== Question Bank Routes ==============
// Get question bank (global questions not associated with any quiz)
router.get('/bank/questions', auth_1.authenticate, async (req, res) => {
    try {
        const questions = await db_1.default.question.findMany({
            where: { quizId: null },
            orderBy: { id: 'desc' },
            include: { options: true },
        });
        res.json(questions);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add question to global question bank
router.post('/bank/questions', auth_1.authenticate, async (req, res) => {
    try {
        const { text, type = 'MULTIPLE_CHOICE', options } = req.body;
        if (!text) {
            res.status(400).json({ error: 'Question text is required' });
            return;
        }
        const validationError = validateQuestion({ type, options });
        if (validationError) {
            res.status(400).json({ error: validationError });
            return;
        }
        const question = await db_1.default.question.create({
            data: {
                text,
                type,
                quizId: null, // Explicitly null for global questions
                options: options ? {
                    create: options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
                } : undefined,
            },
            include: { options: true },
        });
        res.status(201).json(question);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Add questions from bank to a quiz
router.post('/:id/bank', auth_1.authenticate, async (req, res) => {
    try {
        const quizId = parseInt(req.params.id, 10);
        const { questionIds } = req.body;
        if (!Array.isArray(questionIds) || questionIds.length === 0) {
            res.status(400).json({ error: 'Question IDs are required' });
            return;
        }
        const quiz = await db_1.default.quiz.findUnique({
            where: { id: quizId },
            include: { questions: true },
        });
        if (!quiz) {
            res.status(404).json({ error: 'Quiz not found' });
            return;
        }
        if (!isOwnerOrAdmin(req.user.userId, quiz.creatorId, req.user.role)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        // Get questions from bank
        const bankQuestions = await db_1.default.question.findMany({
            where: { id: { in: questionIds }, quizId: null },
            include: { options: true },
        });
        if (bankQuestions.length !== questionIds.length) {
            res.status(400).json({ error: 'Some questions not found in question bank' });
            return;
        }
        // Copy questions to quiz
        const maxOrder = Math.max(...quiz.questions.map((q) => q.order), -1);
        const createdQuestions = await db_1.default.$transaction(bankQuestions.map((q, idx) => db_1.default.question.create({
            data: {
                quizId,
                text: q.text,
                type: q.type,
                order: maxOrder + idx + 1,
                options: {
                    create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
                },
            },
            include: { options: true },
        })));
        res.status(201).json(createdQuestions);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
