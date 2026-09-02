import { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthRequest } from '../middlewares/authMiddleware';
import { logAudit } from '../utils/auditLogger';
import Transaction from '../models/Transaction';
import Token from '../models/Token';

// Mock DB for products
const MOCK_PRODUCTS = [
  { id: 'prod_1', name: 'Basic Noise-Canceling Headphones', price: 150.0, currency: 'USD', brand: 'SoundCo', category: 'electronics' },
  { id: 'prod_2', name: 'Pro Noise-Canceling Headphones', price: 299.99, currency: 'USD', brand: 'AcousticsInc', category: 'electronics' },
  { id: 'prod_3', name: 'Ultra Studio Headphones', price: 450.0, currency: 'USD', brand: 'Audiophile', category: 'electronics' }
];

// In-memory mock session store
interface CheckoutSession {
  session_id: string;
  product_id: string;
  amount: number;
  merchant_id: string;
  status: 'open' | 'completed';
}
const sessions: Record<string, CheckoutSession> = {};

export const searchProducts = async (req: Request, res: Response): Promise<void> => {
  const { query, filters } = req.body;
  // A simple mock search filtering
  const results = MOCK_PRODUCTS.filter(p => 
    p.name.toLowerCase().includes((query || '').toLowerCase())
  );
  res.status(200).json({ products: results });
};

export const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
  const { product_id, quantity } = req.body;
  
  const product = MOCK_PRODUCTS.find(p => p.id === product_id);
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const session_id = 'cs_' + crypto.randomUUID();
  sessions[session_id] = {
    session_id,
    product_id,
    amount: product.price * (quantity || 1),
    merchant_id: 'merchant_004', // Hardcoded electronics merchant for this demo
    status: 'open'
  };

  res.status(200).json({ session_id, amount: sessions[session_id].amount });
};

export const completeCheckout = async (req: AuthRequest, res: Response): Promise<void> => {
  const { session_id } = req.body;
  const tokenData = req.tokenData;

  if (!tokenData) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const session = sessions[session_id];
  if (!session || session.status !== 'open') {
    res.status(400).json({ error: 'Invalid or completed checkout session' });
    return;
  }

  const { agent_id, max_amount, allowed_categories, tokenId } = tokenData;
  const transaction_amount = session.amount;
  const merchant_id = session.merchant_id;
  
  // Category Mock Check (assuming merchant_004 is electronics)
  const merchant_category = 'electronics';

  try {
    if (!allowed_categories.includes('*') && !allowed_categories.includes(merchant_category)) {
      await logAudit({
        agent_id, merchant_id, action: 'PAYMENT_SETTLEMENT', status: 'failure',
        reason: 'Merchant category not authorized by token', metadata: { merchant_category, allowed_categories }
      });
      res.status(403).json({ error: 'CATEGORY_MISMATCH', message: 'Category not authorized' });
      return;
    }

    // 10% Reserve Buffer Logic
    if (transaction_amount > max_amount) {
      const bufferLimit = max_amount * 1.10;
      if (transaction_amount <= bufferLimit) {
        const transaction_id = crypto.randomUUID();
        const newTransaction = new Transaction({
          transaction_id, agent_id, merchant_id, amount: transaction_amount, tokenId: tokenId, status: 'PENDING_ESCALATION'
        });
        await newTransaction.save();

        await logAudit({
          agent_id, merchant_id, action: 'ESCALATION_TRIGGERED', status: 'success',
          metadata: { transaction_amount, max_amount, transaction_id, session_id }
        });

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
        await logAudit({
          agent_id, merchant_id, action: 'PAYMENT_SETTLEMENT', status: 'failure',
          reason: 'Transaction amount strictly exceeds limit and 10% reserve buffer', metadata: { transaction_amount, max_amount }
        });
        res.status(403).json({ error: 'LIMIT_EXCEEDED', message: 'Amount exceeds limit' });
        return;
      }
    }

    // Settle Payment
    session.status = 'completed';
    const logTxId = await logAudit({
      agent_id, merchant_id, action: 'PAYMENT_SETTLEMENT', status: 'success',
      metadata: { transaction_amount, merchant_category, session_id }
    });

    res.status(200).json({
      message: 'Payment settled successfully via ACP',
      transaction_id: logTxId,
      status: 'settled',
      amount: transaction_amount
    });
  } catch (error) {
    await logAudit({
      agent_id, merchant_id, action: 'PAYMENT_SETTLEMENT', status: 'failure',
      reason: 'Server error during ACP settlement', metadata: { error: (error as Error).message }
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};
