import prisma from '../db';

export type AuditAction =
  | 'USER_REGISTER'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_PROFILE_UPDATE'
  | 'USER_PASSWORD_CHANGE'
  | 'QUIZ_CREATED'
  | 'QUIZ_UPDATED'
  | 'QUIZ_DELETED'
  | 'QUIZ_PUBLISHED'
  | 'QUESTION_CREATED'
  | 'QUESTION_UPDATED'
  | 'QUESTION_DELETED'
  | 'QUIZ_ATTEMPT_STARTED'
  | 'QUIZ_ATTEMPT_COMPLETED'
  | 'BADGE_EARNED'
  | 'TIER_CHANGED'
  | 'USER_FOLLOWED'
  | 'USER_UNFOLLOWED'
  | 'REVIEW_CREATED'
  | 'REVIEW_DELETED'
  | 'CONTENT_FLAGGED'
  | 'CONTENT_MODERATED'
  | 'ADMIN_USER_PROMOTED'
  | 'ADMIN_USER_DEMOTED';

export const logAudit = async (
  action: AuditAction,
  userId: number | null,
  entityType?: string,
  entityId?: number,
  details?: Record<string, any>,
  ipAddress?: string
) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId,
        entityType,
        entityId,
        details: details ? JSON.stringify(details) : null,
        ipAddress,
      },
    });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('Failed to write audit log:', error);
  }
};
