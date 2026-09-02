import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logAudit } from '../utils/auditLogger';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_ap2';

export interface AuthRequest extends Request {
  tokenData?: {
    agent_id: string;
    max_amount: number;
    allowed_categories: string[];
    expiry_timestamp: string;
    tokenId: string;
    iat: number;
    exp: number;
  };
}

export const verifyAgentToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    await logAudit({
      action: 'TOKEN_VERIFICATION',
      status: 'failure',
      reason: 'Missing or malformed Authorization header',
      metadata: { headers: req.headers }
    });
    res.status(401).json({ error: 'Missing or malformed token' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest['tokenData'];
    req.tokenData = decoded;
    
    // Check if token itself is expired based on custom expiry_timestamp
    if (new Date(decoded!.expiry_timestamp) < new Date()) {
      await logAudit({
        agent_id: decoded!.agent_id,
        action: 'TOKEN_VERIFICATION',
        status: 'failure',
        reason: 'Token logically expired',
        metadata: { expiry_timestamp: decoded!.expiry_timestamp }
      });
      res.status(401).json({ error: 'Token has expired' });
      return;
    }

    await logAudit({
      agent_id: decoded!.agent_id,
      action: 'TOKEN_VERIFICATION',
      status: 'success',
      metadata: { max_amount: decoded!.max_amount, allowed_categories: decoded!.allowed_categories }
    });

    next();
  } catch (error) {
    await logAudit({
      action: 'TOKEN_VERIFICATION',
      status: 'failure',
      reason: 'Cryptographic signature verification failed',
      metadata: { error: (error as Error).message }
    });
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
};
