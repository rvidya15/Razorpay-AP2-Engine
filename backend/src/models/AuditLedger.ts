import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLedger extends Document {
  transaction_id: string;
  agent_id?: string;
  merchant_id?: string;
  action: string;
  status: 'success' | 'failure';
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

const AuditLedgerSchema: Schema = new Schema({
  transaction_id: { type: String, required: true },
  agent_id: { type: String },
  merchant_id: { type: String },
  action: { type: String, required: true },
  status: { type: String, enum: ['success', 'failure'], required: true },
  reason: { type: String },
  metadata: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model<IAuditLedger>('AuditLedger', AuditLedgerSchema);
