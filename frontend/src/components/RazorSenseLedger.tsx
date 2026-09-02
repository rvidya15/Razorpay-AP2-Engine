'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, Activity, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { useAgentStore, LogEntry } from '../store/useAgentStore';

const MOCK_HEADER = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
const MOCK_SIGNATURE = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

export default function RazorSenseLedger() {
  const { logs } = useAgentStore();
  const [activeLog, setActiveLog] = useState<LogEntry | null>(null);
  const [unpackStage, setUnpackStage] = useState<number>(0);

  // Get the most recent log
  const latestLog = logs[0];

  useEffect(() => {
    if (latestLog && latestLog._id !== activeLog?._id) {
      setActiveLog(latestLog);
      setUnpackStage(0);
      
      // Sequence the animations
      const t1 = setTimeout(() => setUnpackStage(1), 1000); // Split JWT
      const t2 = setTimeout(() => setUnpackStage(2), 2500); // Decode Payload
      const t3 = setTimeout(() => setUnpackStage(3), 4000); // Verify Signature
      const t4 = setTimeout(() => setUnpackStage(4), 5500); // Escalation check

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [latestLog, activeLog]);

  if (!activeLog) {
    return (
      <div className="flex flex-col bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl h-[calc(100vh-200px)] items-center justify-center text-neutral-500">
        <Activity className="animate-pulse mb-4" size={32} />
        <p>Waiting for Secure Agent Transactions...</p>
      </div>
    );
  }

  // Generate a mock base64 payload from the log metadata
  const payloadJson = JSON.stringify({
    agent_id: activeLog.agent_id || 'sys_agent',
    action: activeLog.action,
    ...activeLog.metadata
  }, null, 2);
  const mockPayloadB64 = btoa(payloadJson.replace(/\s/g, '')).substring(0, 40) + '...';

  const isEscalated = activeLog.action === 'ESCALATION_TRIGGERED' || activeLog.status === 'PENDING_ESCALATION';

  return (
    <div className={`flex flex-col backdrop-blur-xl border rounded-2xl overflow-hidden shadow-2xl h-[calc(100vh-200px)] transition-colors duration-500 ${isEscalated && unpackStage >= 4 ? 'bg-orange-950/30 border-orange-800/50' : 'bg-neutral-900/50 border-neutral-800'}`}>
      <div className="bg-neutral-900/80 border-b border-neutral-800 px-4 py-3 flex items-center gap-2">
        <ShieldCheck size={16} className="text-blue-400" />
        <span className="text-sm font-mono text-neutral-400 uppercase tracking-wider">RazorSense Cryptographic Visualizer</span>
      </div>

      <div className="flex-grow overflow-y-auto p-6 flex flex-col gap-6">
        
        {/* Stage 0: Raw Token */}
        <AnimatePresence>
          {unpackStage >= 0 && (
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
          )}
        </AnimatePresence>

        {/* Stage 1 & 2: Token Splitting & Decoding */}
        <AnimatePresence>
          {unpackStage >= 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="bg-red-950/20 border border-red-900/30 p-3 rounded-xl flex flex-col justify-center items-center">
                <span className="text-xs font-mono text-red-500/70 mb-1">HEADER</span>
                <span className="text-red-400 font-mono text-xs">HS256</span>
              </div>
              
              <div className="bg-purple-950/20 border border-purple-900/30 p-3 rounded-xl flex flex-col col-span-1 md:col-span-2">
                <span className="text-xs font-mono text-purple-500/70 mb-2 flex justify-between">
                  <span>PAYLOAD</span>
                  {unpackStage >= 2 && <span className="text-green-400">Decoded</span>}
                </span>
                {unpackStage >= 2 ? (
                  <motion.pre 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-purple-300 font-mono text-xs whitespace-pre-wrap"
                  >
                    {payloadJson}
                  </motion.pre>
                ) : (
                  <div className="text-purple-400 font-mono text-xs break-all animate-pulse">
                    Decrypting...
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage 3: Cryptographic Verification */}
        <AnimatePresence>
          {unpackStage >= 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-2"
            >
              {unpackStage === 2 ? (
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
                  <span className="font-mono text-sm text-green-400">Signature Verified - Token Authentic</span>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stage 4: Escalation Flow (If applicable) */}
        <AnimatePresence>
          {unpackStage >= 4 && isEscalated && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-5 bg-orange-950/40 border border-orange-500/50 rounded-xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-orange-500/10 animate-pulse" />
              <div className="relative z-10 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-orange-500 font-bold tracking-wide">
                  <AlertTriangle size={20} />
                  PENDING HITL ESCALATION
                </div>
                <p className="text-sm text-orange-200/80">
                  Transaction amount exceeds the allowed cryptographic limit by &lt; 10%. Reserve Pay buffer triggered.
                </p>
                <div className="mt-2 bg-neutral-950/50 p-4 rounded-lg border border-orange-900/50 flex items-start gap-3">
                  <MessageSquare className="text-green-500 mt-1" size={18} />
                  <div>
                    <span className="text-xs font-mono text-green-500/70 uppercase mb-1 block">SMS Dispatched to Admin</span>
                    <p className="text-sm font-mono text-neutral-300">
                      "Agent found item for ${activeLog.metadata?.transaction_amount}, exceeding limit of ${activeLog.metadata?.max_amount}. Reply YES to authorize Reserve Pay."
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
