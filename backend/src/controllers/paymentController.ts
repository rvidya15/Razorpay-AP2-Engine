import { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthRequest } from '../middlewares/authMiddleware';
import { logAudit } from '../utils/auditLogger';
import Transaction from '../models/Transaction';
import Token from '../models/Token';

// Mock merchant DB for Phase 1
const mockMerchants: Record<string, { name: string; category: string }> = {
  'merchant_001': { name: 'CloudCompute Inc', category: 'cloud_services' },
  'merchant_002': { name: 'FastAPI SaaS', category: 'software' },
  'merchant_003': { name: 'Global Logistics', category: 'logistics' },
  'merchant_004': { name: 'TechGear Electronics', category: 'electronics' }
};

export const settlePayment = async (req: AuthRequest, res: Response): Promise<void> => {
  const { merchant_id, transaction_amount } = req.body;
  const tokenData = req.tokenData;

  if (!tokenData) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { agent_id, max_amount, allowed_categories, tokenId } = tokenData;

  try {
    if (!merchant_id || !transaction_amount) {
      await logAudit({
        agent_id,
        merchant_id,
        action: 'PAYMENT_SETTLEMENT',
        status: 'failure',
        reason: 'Missing merchant_id or transaction_amount'
      });
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const merchant = mockMerchants[merchant_id];
    if (!merchant) {
      await logAudit({
        agent_id,
        merchant_id,
        action: 'PAYMENT_SETTLEMENT',
        status: 'failure',
        reason: 'Merchant not found in system'
      });
      res.status(400).json({ error: 'Unknown merchant' });
      return;
    }

    // 2. Check Category Restrictions
    if (!allowed_categories.includes('*') && !allowed_categories.includes(merchant.category)) {
      await logAudit({
        agent_id,
        merchant_id,
        action: 'PAYMENT_SETTLEMENT',
        status: 'failure',
        reason: 'Merchant category not authorized by token',
        metadata: { merchant_category: merchant.category, allowed_categories }
      });
      res.status(403).json({ 
        error: 'CATEGORY_MISMATCH', 
        message: 'Merchant category is not authorized for this token' 
      });
      return;
    }

    // 1. Check Amount Limit & 10% Escalation Buffer
    if (transaction_amount > max_amount) {
      const bufferLimit = max_amount * 1.10; // 10% Reserve Buffer
      
      if (transaction_amount <= bufferLimit) {
        // Within 10% Buffer -> Trigger HITL Escalation
        const transaction_id = crypto.randomUUID();
        
        const newTransaction = new Transaction({
          transaction_id,
          agent_id,
          merchant_id,
          amount: transaction_amount,
          tokenId: tokenId,
          status: 'PENDING_ESCALATION'
        });
        await newTransaction.save();

        await logAudit({
          agent_id,
          merchant_id,
          action: 'ESCALATION_TRIGGERED',
          status: 'success',
          metadata: { transaction_amount, max_amount, transaction_id }
        });

        // Mock Twilio / SMS Integration
        console.log(`\n=============================================================================`);
        console.log(`[SMS ALERTER] Sending SMS to User:`);
        console.log(`"Your AP2 Agent found an item for $${transaction_amount}, exceeding its limit of $${max_amount} by less than 10%.`);
        console.log(` Reply YES to authorize the Reserve Pay."`);
        console.log(`=============================================================================\n`);

        res.status(202).json({
          message: 'Transaction exceeds limit but is within the 10% reserve buffer. Escalation triggered.',
          status: 'PENDING_ESCALATION',
          transaction_id
        });
        return;
      } else {
        // Exceeds 10% Buffer -> Hard Reject
        await logAudit({
          agent_id,
          merchant_id,
          action: 'PAYMENT_SETTLEMENT',
          status: 'failure',
          reason: 'Transaction amount strictly exceeds scoped token limit and 10% reserve buffer',
          metadata: { transaction_amount, max_amount }
        });
        res.status(403).json({ 
          error: 'LIMIT_EXCEEDED', 
          message: 'Transaction amount strictly exceeds authorized limit' 
        });
        return;
      }
    }

    // If validations pass and amount <= max_amount, "settle" the payment immediately
    const logTxId = await logAudit({
      agent_id,
      merchant_id,
      action: 'PAYMENT_SETTLEMENT',
      status: 'success',
      metadata: { transaction_amount, merchant_category: merchant.category }
    });

    res.status(200).json({
      message: 'Payment settled successfully',
      transaction_id: logTxId,
      status: 'settled',
      amount: transaction_amount
    });
  } catch (error) {
    await logAudit({
      agent_id,
      merchant_id,
      action: 'PAYMENT_SETTLEMENT',
      status: 'failure',
      reason: 'Server error during settlement',
      metadata: { error: (error as Error).message }
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resolveEscalation = async (req: Request, res: Response): Promise<void> => {
  const { transaction_id, user_approved } = req.body;

  if (!transaction_id || typeof user_approved !== 'boolean') {
    res.status(400).json({ error: 'Missing transaction_id or user_approved boolean' });
    return;
  }

  try {
    const transaction = await Transaction.findOne({ transaction_id });
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    if (transaction.status !== 'PENDING_ESCALATION') {
      res.status(400).json({ error: 'Transaction is not pending escalation' });
      return;
    }

    if (user_approved) {
      transaction.status = 'SETTLED';
      await transaction.save();

      // Dynamically update the token's max limit in the database
      await Token.findByIdAndUpdate(transaction.tokenId, {
        max_amount: transaction.amount
      });

      await logAudit({
        agent_id: transaction.agent_id,
        merchant_id: transaction.merchant_id,
        action: 'PAYMENT_SETTLEMENT',
        status: 'success',
        reason: 'Escalation user-approved via HITL',
        metadata: { transaction_amount: transaction.amount, transaction_id }
      });

      res.status(200).json({ message: 'Escalation approved, limit dynamically updated, and payment settled', transaction_id });
    } else {
      transaction.status = 'REJECTED';
      await transaction.save();

      await logAudit({
        agent_id: transaction.agent_id,
        merchant_id: transaction.merchant_id,
        action: 'ESCALATION_REJECTED',
        status: 'failure',
        reason: 'User explicitly denied the reserve pay request',
        metadata: { transaction_id }
      });

      res.status(403).json({ error: 'Escalation denied by user', transaction_id });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error resolving escalation' });
  }
};
