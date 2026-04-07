import { z } from 'zod';

export const optionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

export const questionSchema = z.object({
  text: z.string().min(1),
  order: z.number().int().optional(),
  type: z.enum(['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_SELECT', 'FILL_BLANK']).default('MULTIPLE_CHOICE'),
  options: z.array(optionSchema).min(1).max(6).optional(), // Optional for FILL_BLANK
});

export const createQuizSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  timeLimit: z.number().int().min(30).max(3600).default(600),
  maxAttempts: z.number().int().min(1).nullable().optional(), // Null = unlimited
  isPublished: z.boolean().default(true),
  shuffleQuestions: z.boolean().default(false),
  availableFrom: z.string().datetime().nullable().optional(),
  availableUntil: z.string().datetime().nullable().optional(),
  questions: z.array(questionSchema).min(1),
});

export const updateQuizSchema = createQuizSchema.partial().omit({ questions: true });

export const submitQuizSchema = z.object({
  answers: z.record(z.string(), z.union([z.number(), z.array(z.number()), z.string()])), // Support multi-select and fill-blank
  attemptId: z.number().optional(),
  elapsedSeconds: z.number().int().optional(),
});

export const duplicateQuizSchema = z.object({
  newTitle: z.string().min(1).max(200).optional(),
});
