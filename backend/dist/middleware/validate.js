"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = void 0;
const validateBody = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.issues.map((e) => e.message).join(', ') });
    }
    req.body = result.data;
    next();
};
exports.validateBody = validateBody;
