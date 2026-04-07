import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;

// Configure pool with Neon-compatible settings
const pool = new Pool({
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
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
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

export default prisma;
