import mongoose, { Schema, Document } from 'mongoose';

export interface IToken extends Document {
  agent_id: string;
  max_amount: number;
  allowed_categories: string[];
  expiry_timestamp: Date;
  status: 'active' | 'revoked' | 'expired';
}

const TokenSchema: Schema = new Schema({
  agent_id: { type: String, required: true },
  max_amount: { type: Number, required: true },
  allowed_categories: { type: [String], required: true },
  expiry_timestamp: { type: Date, required: true },
  status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active' }
}, {
  timestamps: true
});

export default mongoose.model<IToken>('Token', TokenSchema);
