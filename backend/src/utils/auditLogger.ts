import AuditLedger from '../models/AuditLedger';
import crypto from 'crypto';
import { getIO } from './socketManager';

interface LogPayload {
  agent_id?: string;
  merchant_id?: string;
  action: string;
  status: 'success' | 'failure';
  reason?: string;
  metadata?: Record<string, any>;
}

export const logAudit = async (payload: LogPayload) => {
  try {
    const transaction_id = crypto.randomUUID();
    const logEntry = new AuditLedger({
      transaction_id,
      ...payload
    });
    await logEntry.save();
    
    try {
      getIO().emit('new_log', logEntry);
    } catch (error) {
      // Silently fail if socket isn't ready
    }

    console.log(`[AUDIT] ${payload.action} - ${payload.status} ${payload.reason ? `(${payload.reason})` : ''}`);
    return transaction_id;
  } catch (error) {
    console.error('[AUDIT_ERROR] Failed to save audit log:', error);
  }
};
