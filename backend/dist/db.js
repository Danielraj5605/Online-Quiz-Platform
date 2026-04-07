"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
require("dotenv/config");
const connectionString = process.env.DATABASE_URL;
// Configure pool with Neon-compatible settings
const pool = new pg_1.Pool({
    connectionString,
    max: 5, // Lower limit for Neon free tier
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000, // 15 second connection timeout for cold starts
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
});
pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
});
// Create adapter for Neon
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({
    adapter,
    log: ['error', 'warn'],
});
// Handle connection events for debugging
pool.on('connect', () => {
    console.log('Database pool: new client connected');
});
pool.on('acquire', () => {
    console.log('Database pool: client acquired');
});
exports.default = prisma;
