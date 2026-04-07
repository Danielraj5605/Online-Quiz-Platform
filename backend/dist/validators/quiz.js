"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duplicateQuizSchema = exports.submitQuizSchema = exports.updateQuizSchema = exports.createQuizSchema = exports.questionSchema = exports.optionSchema = void 0;
const zod_1 = require("zod");
exports.optionSchema = zod_1.z.object({
    text: zod_1.z.string().min(1),
    isCorrect: zod_1.z.boolean(),
});
exports.questionSchema = zod_1.z.object({
    text: zod_1.z.string().min(1),
    order: zod_1.z.number().int().optional(),
    type: zod_1.z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_SELECT', 'FILL_BLANK']).default('MULTIPLE_CHOICE'),
    options: zod_1.z.array(exports.optionSchema).min(1).max(6).optional(), // Optional for FILL_BLANK
});
exports.createQuizSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200),
    description: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    difficulty: zod_1.z.enum(['easy', 'medium', 'hard']).default('medium'),
    timeLimit: zod_1.z.number().int().min(30).max(3600).default(600),
    maxAttempts: zod_1.z.number().int().min(1).nullable().optional(), // Null = unlimited
    isPublished: zod_1.z.boolean().default(true),
    shuffleQuestions: zod_1.z.boolean().default(false),
    availableFrom: zod_1.z.string().datetime().nullable().optional(),
    availableUntil: zod_1.z.string().datetime().nullable().optional(),
    questions: zod_1.z.array(exports.questionSchema).min(1),
});
exports.updateQuizSchema = exports.createQuizSchema.partial().omit({ questions: true });
exports.submitQuizSchema = zod_1.z.object({
    answers: zod_1.z.record(zod_1.z.string(), zod_1.z.union([zod_1.z.number(), zod_1.z.array(zod_1.z.number()), zod_1.z.string()])), // Support multi-select and fill-blank
    attemptId: zod_1.z.number().optional(),
    elapsedSeconds: zod_1.z.number().int().optional(),
});
exports.duplicateQuizSchema = zod_1.z.object({
    newTitle: zod_1.z.string().min(1).max(200).optional(),
});
