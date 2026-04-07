"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
require("dotenv/config");
const auth_1 = __importDefault(require("./routes/auth"));
const quiz_1 = __importDefault(require("./routes/quiz"));
const admin_1 = __importDefault(require("./routes/admin"));
const user_1 = __importDefault(require("./routes/user"));
const leaderboard_1 = __importDefault(require("./routes/leaderboard"));
const social_1 = __importDefault(require("./routes/social"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const logger_1 = require("./middleware/logger");
const db_1 = __importDefault(require("./db"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Security: CORS - restrict to frontend origin in production
const corsOptions = process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL
    ? { origin: process.env.FRONTEND_URL }
    : {};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '10kb' })); // Prevent large payload attacks
// Security: Rate limiting
const globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
// Stricter rate limit for auth routes
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 attempts per 15 minutes for auth endpoints
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts, please try again later.' },
});
app.use(globalLimiter);
// Request logging
app.use(logger_1.requestLogger);
app.use('/api/auth', authLimiter, auth_1.default);
app.use('/api/quiz', quiz_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/user', user_1.default);
app.use('/api/leaderboard', leaderboard_1.default);
app.use('/api/social', social_1.default);
app.use('/api/analytics', analytics_1.default);
// Global error handler (must be after all routes)
app.use(logger_1.errorLogger);
app.use((err, _req, res, _next) => {
    console.error('Final error handler:', err);
    res.status(500).json({ error: 'Internal server error' });
});
app.get('/health', async (req, res) => {
    try {
        // Test database connection
        await db_1.default.$queryRaw `SELECT 1`;
        res.status(200).json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    }
    catch (error) {
        console.error('Database health check failed:', error.message);
        res.status(503).json({ status: 'error', database: 'disconnected', error: error.message, timestamp: new Date().toISOString() });
    }
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
