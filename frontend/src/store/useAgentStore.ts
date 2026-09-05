import { create } from 'zustand';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

export interface LogEntry {
  _id: string;
  transaction_id: string;
  agent_id?: string;
  merchant_id?: string;
  action: string;
  status: 'success' | 'failure' | 'PENDING_ESCALATION';
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface AgentThought {
  type: string;
  content: string;
  tool_name?: string;
  timestamp: string;
}

interface AgentStore {
  logs: LogEntry[];
  thoughts: AgentThought[];
  isPolling: boolean;
  agentStatus: 'idle' | 'running';
  triggerAgent: () => Promise<void>;
  fetchLogs: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  socket: Socket | null;
  visualizerState: 'IDLE' | 'TOKEN_PARSED' | 'VERIFYING_SIGNATURE' | 'SIGNATURE_VALID' | 'ESCALATION_PENDING' | 'SETTLED' | 'REJECTED';
  setVisualizerState: (state: any) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const SOCKET_URL = API_URL.replace('/api', '');

export const useAgentStore = create<AgentStore>((set, get) => {
  let socket: Socket | null = null;

  return {
    logs: [],
    thoughts: [],
    isPolling: false,
    agentStatus: 'idle',
    socket: null,
    visualizerState: 'IDLE',

    setVisualizerState: (state) => set({ visualizerState: state }),

    fetchLogs: async () => {
      try {
        const response = await axios.get(`${API_URL}/logs`);
        set({ logs: response.data });
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    },

    triggerAgent: async () => {
      try {
        set({ agentStatus: 'running', thoughts: [], visualizerState: 'IDLE' });
        await axios.post(`${API_URL}/trigger-agent`);
        setTimeout(() => set({ agentStatus: 'idle' }), 5000);
      } catch (error) {
        console.error('Failed to trigger agent:', error);
        set({ agentStatus: 'idle' });
      }
    },

    startPolling: () => {
      if (get().isPolling) return;
      set({ isPolling: true });
      get().fetchLogs();
      
      socket = io(SOCKET_URL);
      
      socket.on('new_log', (newLog: LogEntry) => {
        set((state) => ({ logs: [newLog, ...state.logs] }));
        
        if (newLog.action === 'TOKEN_ISSUANCE') {
          set({ visualizerState: 'TOKEN_PARSED' });
        } else if (newLog.action === 'TOKEN_VERIFICATION') {
          set({ visualizerState: 'VERIFYING_SIGNATURE' });
          setTimeout(() => set({ visualizerState: 'SIGNATURE_VALID' }), 1500);
        } else if (newLog.action === 'ESCALATION_TRIGGERED') {
          set({ visualizerState: 'ESCALATION_PENDING' });
        } else if (newLog.action === 'PAYMENT_SETTLEMENT') {
           set({ visualizerState: newLog.status === 'success' ? 'SETTLED' : 'REJECTED' });
        }
      });

      socket.on('agent_thought', (thought: AgentThought) => {
        set((state) => ({ thoughts: [...state.thoughts, thought] }));
      });
      
      set({ socket });
    },

    stopPolling: () => {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      set({ isPolling: false, socket: null, visualizerState: 'IDLE' });
    }
  };
});
