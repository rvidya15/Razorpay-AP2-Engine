import { create } from 'zustand';
import axios from 'axios';

export interface LogEntry {
  _id: string;
  transaction_id: string;
  agent_id?: string;
  merchant_id?: string;
  action: string;
  status: 'success' | 'failure';
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface AgentStore {
  logs: LogEntry[];
  isPolling: boolean;
  agentStatus: 'idle' | 'running';
  triggerAgent: () => Promise<void>;
  fetchLogs: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

const API_URL = 'http://localhost:3001/api';

export const useAgentStore = create<AgentStore>((set, get) => {
  let pollInterval: NodeJS.Timeout | null = null;

  return {
    logs: [],
    isPolling: false,
    agentStatus: 'idle',

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
        set({ agentStatus: 'running' });
        await axios.post(`${API_URL}/trigger-agent`);
        // We rely on polling to fetch new logs, but after a successful trigger we set back to idle after a delay
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
      pollInterval = setInterval(() => {
        get().fetchLogs();
      }, 2000);
    },

    stopPolling: () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      set({ isPolling: false });
    }
  };
});
