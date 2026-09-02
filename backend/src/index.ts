import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import { exec } from 'child_process';
import path from 'path';
import { issueToken } from './controllers/tokenController';
import { settlePayment, resolveEscalation } from './controllers/paymentController';
import { searchProducts, createCheckoutSession, completeCheckout } from './controllers/acpController';
import { verifyAgentToken } from './middlewares/authMiddleware';
import AuditLedger from './models/AuditLedger';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/razorpay_ap2';

// Standard Routes
app.post('/api/tokens/issue', issueToken);
app.post('/api/payments/settle', verifyAgentToken, settlePayment);
app.post('/api/payments/escalation/resolve', resolveEscalation);

// ACP Standard Routes
app.post('/acp/v1/search', searchProducts);
app.post('/acp/v1/checkout_session', createCheckoutSession);
app.post('/acp/v1/complete_checkout', verifyAgentToken, completeCheckout);

// Dashboard Routes
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await AuditLedger.find().sort({ timestamp: -1 }).limit(50);
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.post('/api/trigger-agent', (req, res) => {
  const agentScript = path.join(__dirname, '../../agents/agent-negotiation.js');
  // Load the script via node
  // Pass GEMINI_API_KEY from environment if possible, or assume it's set in the agents/.env
  // Execute the child process
  exec(`node "${agentScript}"`, { cwd: path.join(__dirname, '../../agents') }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Agent execution error: ${error.message}`);
      return;
    }
    if (stderr) console.error(`Agent stderr: ${stderr}`);
    console.log(`Agent stdout: ${stdout}`);
  });
  
  res.status(200).json({ message: 'Agent triggered successfully. Check logs.' });
});

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start Server & Connect to DB
const startServer = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB at ${MONGO_URI}`);
    
    app.listen(PORT, () => {
      console.log(`Razorpay AP2 Backend listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
