"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeObject = exports.sanitizeString = void 0;
const xss_1 = __importDefault(require("xss"));
// Sanitize HTML to prevent XSS attacks
const xssOptions = {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style'],
};
const sanitizeString = (input) => {
    return (0, xss_1.default)(input, xssOptions).trim();
};
exports.sanitizeString = sanitizeString;
const sanitizeObject = (obj, fields) => {
    const sanitized = {};
    for (const field of fields) {
        if (typeof obj[field] === 'string') {
            sanitized[field] = (0, exports.sanitizeString)(obj[field]);
        }
    }
    return sanitized;
};
exports.sanitizeObject = sanitizeObject;
