"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = void 0;
const db_1 = __importDefault(require("../db"));
const logAudit = async (action, userId, entityType, entityId, details, ipAddress) => {
    try {
        await db_1.default.auditLog.create({
            data: {
                action,
                userId,
                entityType,
                entityId,
                details: details ? JSON.stringify(details) : null,
                ipAddress,
            },
        });
    }
    catch (error) {
        // Don't fail the main operation if audit logging fails
        console.error('Failed to write audit log:', error);
    }
};
exports.logAudit = logAudit;
