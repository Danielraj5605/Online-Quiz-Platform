"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// Global leaderboard (top 20 by score percentage, then time)
router.get('/', async (_req, res) => {
    try {
        const top = await db_1.default.result.findMany({
            orderBy: [{ score: 'desc' }, { timeTaken: 'asc' }, { createdAt: 'asc' }],
            take: 20,
            include: { user: { select: { username: true } }, quiz: { select: { title: true } } },
        });
        res.json(top);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
