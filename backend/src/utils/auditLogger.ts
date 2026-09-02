import AuditLedger from '../models/AuditLedger';
import crypto from 'crypto';

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
    console.log(`[AUDIT] ${payload.action} - ${payload.status} ${payload.reason ? `(${payload.reason})` : ''}`);
    return transaction_id;
  } catch (error) {
    console.error('[AUDIT_ERROR] Failed to save audit log:', error);
  }
};
