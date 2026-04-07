"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.passwordChangeSchema = exports.profileUpdateSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
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
const isSafeUrl = (url) => {
    try {
        const parsed = new URL(url);
        // Only allow http and https
        if (!['http:', 'https:'].includes(parsed.protocol))
            return false;
        // Check against dangerous patterns
        const hostname = parsed.hostname.toLowerCase();
        return !DANGEROUS_URL_PATTERNS.some((pattern) => pattern.test(hostname));
    }
    catch {
        return false;
    }
};
// Password strength validation
const passwordStrength = (password) => {
    if (password.length < 8)
        return false;
    if (!/[A-Z]/.test(password))
        return false;
    if (!/[a-z]/.test(password))
        return false;
    if (!/[0-9]/.test(password))
        return false;
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
        return false;
    return true;
};
exports.registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(30),
    email: zod_1.z.string().email(),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(100)
        .refine(passwordStrength, 'Password must contain uppercase, lowercase, number, and special character'),
    name: zod_1.z.string().min(1).max(100).optional(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.profileUpdateSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(30).optional(),
    email: zod_1.z.string().email().optional(),
    name: zod_1.z.string().min(1).max(100).optional(),
    avatar: zod_1.z.string().url().refine(isSafeUrl, { message: 'Invalid avatar URL' }).optional(),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(100)
        .refine(passwordStrength, 'Password must contain uppercase, lowercase, number, and special character')
        .optional(),
});
exports.passwordChangeSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1),
    newPassword: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(100)
        .refine(passwordStrength, 'Password must contain uppercase, lowercase, number, and special character'),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    newPassword: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(100)
        .refine(passwordStrength, 'Password must contain uppercase, lowercase, number, and special character'),
});
