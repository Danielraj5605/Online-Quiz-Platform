"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorLogger = exports.requestLogger = void 0;
const LOG_COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};
const formatTimestamp = () => {
    return new Date().toISOString();
};
const getStatusColor = (status) => {
    if (status >= 500)
        return LOG_COLORS.red;
    if (status >= 400)
        return LOG_COLORS.yellow;
    if (status >= 300)
        return LOG_COLORS.cyan;
    return LOG_COLORS.green;
};
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip || req.socket.remoteAddress;
    // Log incoming request
    console.log(`${LOG_COLORS.blue}[${formatTimestamp()}]${LOG_COLORS.reset} ${LOG_COLORS.cyan}${method}${LOG_COLORS.reset} ${url} - IP: ${ip}`);
    // Capture response
    const originalSend = res.send;
    res.send = function (body) {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const color = getStatusColor(status);
        console.log(`${LOG_COLORS.blue}[${formatTimestamp()}]${LOG_COLORS.reset} ${LOG_COLORS.cyan}${method}${LOG_COLORS.reset} ${url} ${color}${status}${LOG_COLORS.reset} - ${duration}ms`);
        return originalSend.call(this, body);
    };
    next();
};
exports.requestLogger = requestLogger;
const errorLogger = (err, req, res, next) => {
    const timestamp = formatTimestamp();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip || req.socket.remoteAddress;
    console.error(`${LOG_COLORS.red}[${timestamp}] ERROR:${LOG_COLORS.reset} ${method} ${url} - IP: ${ip}`);
    console.error(`${LOG_COLORS.red}Error:${LOG_COLORS.reset}`, err.message);
    console.error(`${LOG_COLORS.red}Stack:${LOG_COLORS.reset}`, err.stack);
    next(err);
};
exports.errorLogger = errorLogger;
