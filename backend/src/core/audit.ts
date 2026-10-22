import type { Request } from 'express';
import { prisma } from './db';

export async function audit(req: Request | null, actorId: string | null, action: string, entityType: string, entityId?: string | null, meta?: object) {
  try {
    await prisma.auditLog.create({ data: { actorId, action, entityType, entityId: entityId ?? null, meta: meta as object | undefined, ip: req?.ip ?? null } });
  } catch (e) {
    console.error('audit write failed', e);
  }
}
