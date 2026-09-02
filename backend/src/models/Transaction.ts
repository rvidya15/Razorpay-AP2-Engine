import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  transaction_id: string;
  agent_id: string;
  merchant_id: string;
  amount: number;
  tokenId: string;
  status: 'PENDING_ESCALATION' | 'SETTLED' | 'REJECTED';
  timestamp: Date;
}

const TransactionSchema: Schema = new Schema({
  transaction_id: { type: String, required: true, unique: true },
  agent_id: { type: String, required: true },
  merchant_id: { type: String, required: true },
  amount: { type: Number, required: true },
  tokenId: { type: Schema.Types.ObjectId, ref: 'Token', required: true },
  status: { type: String, enum: ['PENDING_ESCALATION', 'SETTLED', 'REJECTED'], required: true },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
