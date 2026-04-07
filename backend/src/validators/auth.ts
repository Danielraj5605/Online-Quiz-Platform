import { z } from 'zod';

// Dangerous URL patterns for SSRF protection
const DANGEROUS_URL_PATTERNS = [
  /^(https?:\/\/)?localhost/i,
  /^(https?:\/\/)?127\.\d+\.\d+\.\d+/i,
  /^(https?:\/\/)?10\.\d+\.\d+\.\d+/i,
  /^(https?:\/\/)?172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/i,
  /^(https?:\/\/)?192\.168\.\d+\.\d+/i,
  /^(https?:\/\/)?0\.0\.0\.0/i,
  /^(https?:\/\/)?metadata\.google/i,
  /^(https?:\/\/)?169\.254\.169\.254/i,
];

const isSafeUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    // Check against dangerous patterns
    const hostname = parsed.hostname.toLowerCase();
    return !DANGEROUS_URL_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
};

// Password strength validation
const passwordStrength = (password: string) => {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
  return true;
};

export const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .refine(passwordStrength, 'Password must contain uppercase, lowercase, number, and special character'),
  name: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const profileUpdateSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  email: z.string().email().optional(),
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().url().refine(isSafeUrl, { message: 'Invalid avatar URL' }).optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .refine(passwordStrength, 'Password must contain uppercase, lowercase, number, and special character')
    .optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .refine(passwordStrength, 'Password must contain uppercase, lowercase, number, and special character'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .refine(passwordStrength, 'Password must contain uppercase, lowercase, number, and special character'),
});
