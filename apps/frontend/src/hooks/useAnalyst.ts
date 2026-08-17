import { useState, useEffect, useCallback } from 'react';
import {
  AnalystMessage,
  AnalystConfig,
  OllamaModelInfo,
} from '@network-monitor/shared';

export interface UseAnalystReturn {
  messages: AnalystMessage[];
  isLoading: boolean;
  config: AnalystConfig | null;
  availableModels: OllamaModelInfo[];
  sendQuery: (query: string) => Promise<AnalystMessage | null>;
  updateConfig: (newConfig: Partial<AnalystConfig>) => Promise<boolean>;
  clearMessages: () => void;
  fetchConfig: () => Promise<void>;
  fetchModels: () => Promise<void>;
}

export function useAnalyst(): UseAnalystReturn {
  const [messages, setMessages] = useState<AnalystMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: '👋 Hello! I am your **Local AI Network Analyst**. You can ask me questions about active sockets, AI agent traffic, bandwidth spikes, or connection patterns.',
      timestamp: new Date().toISOString(),
      suggestedActions: [
        { label: 'What is using the most bandwidth right now?', actionType: 'filter_traffic', target: 'top' },
        { label: 'Which AI agents are currently active?', actionType: 'view_agent', target: 'all' },
      ],
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AnalystConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<OllamaModelInfo[]>([]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/analyst/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/analyst/models');
      if (res.ok) {
        const data = await res.json();
        setAvailableModels(data.models || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchModels();
  }, [fetchConfig, fetchModels]);

  const sendQuery = async (query: string): Promise<AnalystMessage | null> => {
    if (!query.trim() || isLoading) return null;

    const userMsg: AnalystMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/analyst/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), history: messages }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyMsg = data.reply as AnalystMessage;
        setMessages((prev) => [...prev, replyMsg]);
        return replyMsg;
      }
    } catch {
      const errorMsg: AnalystMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: '❌ Could not reach the AI Analyst server. Please check your local connection.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const updateConfig = async (newConfig: Partial<AnalystConfig>): Promise<boolean> => {
    try {
      const res = await fetch('/api/analyst/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return {
    messages,
    isLoading,
    config,
    availableModels,
    sendQuery,
    updateConfig,
    clearMessages,
    fetchConfig,
    fetchModels,
  };
}
