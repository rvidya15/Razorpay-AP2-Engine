'use client';

import React, { useEffect, useRef } from 'react';
import { useAgentStore, LogEntry } from '../store/useAgentStore';
import { Terminal, Activity, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import RazorSenseLedger from '../components/RazorSenseLedger';

export default function Dashboard() {
  const { logs, thoughts, startPolling, stopPolling, triggerAgent, agentStatus } = useAgentStore();
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  // Reverse logs for table (newest first), but we want chronological for terminal (oldest first)
  const chronologicalLogs = [...logs].reverse();

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-10 font-sans flex flex-col relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="flex justify-between items-center mb-8 z-10 relative">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="text-blue-500" size={32} />
            Razorpay AP2
          </h1>
          <p className="text-neutral-400 mt-1">Autonomous Agent Payment Protocol (M2M)</p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={clearLogs}
            disabled={agentStatus === 'running'}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-neutral-400 hover:text-white hover:bg-neutral-900 border border-neutral-800 transition-all duration-300"
          >
            Reset Demo
          </button>
          
          <button
            onClick={triggerAgent}
            disabled={agentStatus === 'running'}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
              agentStatus === 'running' 
                ? 'bg-blue-600/50 text-blue-200 cursor-not-allowed shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                : 'bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] active:scale-95'
            }`}
          >
            {agentStatus === 'running' ? (
              <span className="flex items-center gap-2">
                <Activity className="animate-spin" size={18} />
                Negotiating...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Initialize Agent Task
                <ArrowRight size={18} />
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-grow z-10 relative min-h-0">
        
        {/* Left Side: Terminal Feed */}
        <div className="flex flex-col bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl h-[calc(100vh-200px)]">
          <div className="bg-neutral-900/80 border-b border-neutral-800 px-4 py-3 flex items-center gap-2">
            <Terminal size={16} className="text-neutral-400" />
            <span className="text-sm font-mono text-neutral-400 uppercase tracking-wider">Agent.stdout (Buyer)</span>
          </div>
          <div 
            ref={terminalRef}
            className="flex-grow p-6 overflow-y-auto font-mono text-sm space-y-4"
          >
            {thoughts.length === 0 && chronologicalLogs.length === 0 ? (
              <div className="text-neutral-600 italic">Waiting for agent activity...</div>
            ) : null}

            {/* Render Agent Thoughts */}
            {thoughts.map((thought, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                key={`thought-${i}`} 
                className={`leading-relaxed ${thought.type === 'tool' ? 'text-blue-300' : 'text-yellow-500'}`}
              >
                <span className="text-neutral-500 mr-2">[{new Date(thought.timestamp).toLocaleTimeString()}]</span>
                <span className="text-neutral-400 mr-2">[Brain]</span>
                {thought.type === 'tool' 
                  ? `Executing tool: ${thought.tool_name}` 
                  : (typeof thought.content === 'string' ? thought.content : JSON.stringify(thought.content))}
              </motion.div>
            ))}

            {/* Render Standard Logs */}
            {chronologicalLogs.map((log) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={log._id} 
                  className="leading-relaxed text-neutral-300"
                >
                  <span className="text-green-500 mr-2">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className="text-blue-400 mr-2">[{log.agent_id || 'System'}]</span>
                  <span>{log.action}</span>
                  {log.status === 'success' && <span className="ml-2 text-green-400">[SUCCESS]</span>}
                  {log.status === 'failure' && <span className="ml-2 text-red-400">[FAILED]</span>}
                  
                  {log.metadata && (
                    <pre className="mt-2 ml-4 p-3 bg-neutral-950/50 rounded-lg text-xs text-neutral-400 overflow-x-auto border border-neutral-800">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                  {log.reason && (
                    <div className="mt-1 ml-4 text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle size={12} />
                      {log.reason}
                    </div>
                  )}
                </motion.div>
              ))}
          </div>
        </div>

        {/* Right Side: RazorSense Visualizer */}
        <RazorSenseLedger />

      </div>
    </div>
  );
}
