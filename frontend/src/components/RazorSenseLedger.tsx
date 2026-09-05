'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, Activity, CheckCircle, AlertTriangle, MessageSquare, Check } from 'lucide-react';
import { useAgentStore, LogEntry } from '../store/useAgentStore';
import axios from 'axios';

const MOCK_HEADER = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
const MOCK_SIGNATURE = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

export default function RazorSenseLedger() {
  const { logs, visualizerState, setVisualizerState } = useAgentStore();
  const [activeLog, setActiveLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    // Keep activeLog synced with the latest log that has metadata
    const latestWithMeta = logs.find(l => l.metadata);
    if (latestWithMeta) {
      setActiveLog(latestWithMeta);
    }
  }, [logs]);

  if (visualizerState === 'IDLE' || !activeLog) {
    return (
      <div className="flex flex-col bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl h-[calc(100vh-200px)] items-center justify-center text-neutral-500">
        <Activity className="animate-pulse mb-4" size={32} />
        <p>Waiting for Secure Agent Transactions...</p>
      </div>
    );
  }

  const payloadJson = JSON.stringify({
    agent_id: activeLog.agent_id || 'sys_agent',
    action: activeLog.action,
    ...activeLog.metadata
  }, null, 2);
  const mockPayloadB64 = btoa(payloadJson.replace(/\s/g, '')).substring(0, 40) + '...';

  const isEscalated = visualizerState === 'ESCALATION_PENDING';
  const isSettled = visualizerState === 'SETTLED';

  const handleApprove = async () => {
    if (!activeLog.metadata?.transaction_id) return;
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      await axios.post(`${API_URL}/payments/escalation/resolve`, {
        transaction_id: activeLog.metadata.transaction_id,
        user_approved: true
      });
      setVisualizerState('SETTLED');
    } catch (error) {
      console.error('Failed to approve transaction', error);
    }
  };

  return (
    <div className={`flex flex-col backdrop-blur-xl border rounded-2xl overflow-hidden shadow-2xl h-[calc(100vh-200px)] transition-colors duration-500 ${isEscalated ? 'bg-orange-950/30 border-orange-800/50' : 'bg-neutral-900/50 border-neutral-800'}`}>
      <div className="bg-neutral-900/80 border-b border-neutral-800 px-4 py-3 flex items-center gap-2">
        <ShieldCheck size={16} className="text-blue-400" />
        <span className="text-sm font-mono text-neutral-400 uppercase tracking-wider">RazorSense Cryptographic Visualizer</span>
      </div>

      <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6">
        
        {/* Stage 0: Raw Token */}
        <AnimatePresence>
          <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-neutral-950/80 border border-neutral-800 p-4 rounded-xl"
            >
              <h3 className="text-xs font-mono text-neutral-500 mb-2 uppercase tracking-widest flex items-center gap-2">
                <Lock size={12} /> Intercepted JWT Token
              </h3>
              <div className="font-mono text-sm break-all">
                <span className="text-red-400">{MOCK_HEADER}</span>.
                <span className="text-purple-400">{mockPayloadB64}</span>.
                <span className="text-blue-400">{MOCK_SIGNATURE}</span>
              </div>
            </motion.div>
        </AnimatePresence>

        {/* Stage 1: Token Decoding */}
        <AnimatePresence>
          {['TOKEN_PARSED', 'VERIFYING_SIGNATURE', 'SIGNATURE_VALID', 'ESCALATION_PENDING', 'SETTLED'].includes(visualizerState) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-purple-950/20 border border-purple-900/30 p-4 rounded-xl flex flex-col"
            >
              <span className="text-xs font-mono text-purple-500/70 mb-2 flex justify-between">
                <span>DECODED PAYLOAD</span>
                <span className="text-green-400">Decoded</span>
              </span>
              <pre className="text-purple-300 font-mono text-xs whitespace-pre-wrap">
                {payloadJson}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage 2: Cryptographic Verification */}
        <AnimatePresence>
          {['VERIFYING_SIGNATURE', 'SIGNATURE_VALID', 'ESCALATION_PENDING', 'SETTLED'].includes(visualizerState) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              {visualizerState === 'VERIFYING_SIGNATURE' ? (
                <div className="flex items-center gap-3 p-4 bg-blue-950/20 border border-blue-900/30 rounded-xl">
                  <Activity className="animate-spin text-blue-400" size={20} />
                  <span className="font-mono text-sm text-blue-400">Verifying ECDSA Signature...</span>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 p-4 bg-green-950/20 border border-green-900/50 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                >
                  <CheckCircle className="text-green-500" size={20} />
                  <span className="font-mono text-sm font-bold text-green-400">ECDSA Signature: VERIFIED</span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage 3: Deterministic Guardrail Check & Escalation */}
        <AnimatePresence>
          {['ESCALATION_PENDING', 'SETTLED'].includes(visualizerState) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 border rounded-xl relative overflow-hidden ${isSettled ? 'bg-green-950/20 border-green-900/50' : 'bg-orange-950/40 border-orange-500/50'}`}
            >
              <div className="relative z-10 flex flex-col gap-3">
                <div className={`flex items-center gap-2 font-bold tracking-wide ${isSettled ? 'text-green-400' : 'text-orange-500'}`}>
                  {isSettled ? <Check size={20} /> : <AlertTriangle size={20} />}
                  {isSettled ? 'PAYMENT SETTLED' : 'UPI RESERVE PAY ACTIVE'}
                </div>

                <div className="bg-neutral-950/50 p-4 rounded-lg border border-neutral-800">
                  <h4 className="text-xs font-mono text-neutral-500 mb-2">DETERMINISTIC GUARDRAIL CHECK</h4>
                  <div className="flex justify-between items-center text-sm font-mono">
                    <span className="text-neutral-400">Requested Amount:</span>
                    <span className="text-red-400">${activeLog.metadata?.transaction_amount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-mono mt-1">
                    <span className="text-neutral-400">Token Max Limit:</span>
                    <span className="text-blue-400">${activeLog.metadata?.max_amount}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-neutral-800 text-xs text-neutral-500">
                    Difference within 10% Reserve Buffer limit.
                  </div>
                </div>

                {!isSettled && (
                  <div className="mt-2 flex flex-col gap-3">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="text-green-500 mt-1" size={18} />
                      <div>
                        <span className="text-xs font-mono text-green-500/70 uppercase mb-1 block">Awaiting SMS/Admin Confirmation</span>
                        <p className="text-sm font-mono text-neutral-300">
                          Agent requested ${activeLog.metadata?.transaction_amount}, exceeding limit of ${activeLog.metadata?.max_amount}.
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleApprove}
                      className="mt-2 w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <ShieldCheck size={18} />
                      Approve Reserve Pay
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
