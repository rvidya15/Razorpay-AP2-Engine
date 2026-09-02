import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Token from '../models/Token';
import { logAudit } from '../utils/auditLogger';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_ap2';

export const issueToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agent_id, max_amount, allowed_categories, validity_minutes = 60 } = req.body;

    if (!agent_id || !max_amount || !allowed_categories) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const expiry_timestamp = new Date(Date.now() + validity_minutes * 60000);

    // Save token state to DB
    const tokenRecord = new Token({
      agent_id,
      max_amount,
      allowed_categories,
      expiry_timestamp,
      status: 'active'
    });
    await tokenRecord.save();

    // Generate JWT
    const payload = {
      agent_id,
      max_amount,
      allowed_categories,
      expiry_timestamp: expiry_timestamp.toISOString(),
      tokenId: tokenRecord._id
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: `${validity_minutes}m` });

    await logAudit({
      agent_id,
      action: 'TOKEN_ISSUANCE',
      status: 'success',
      metadata: { max_amount, allowed_categories, validity_minutes }
    });

    res.status(201).json({
      message: 'Token issued successfully',
      token,
      expires_at: expiry_timestamp
    });
  } catch (error) {
    await logAudit({
      action: 'TOKEN_ISSUANCE',
      status: 'failure',
      reason: 'Server error during issuance',
      metadata: { error: (error as Error).message }
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
