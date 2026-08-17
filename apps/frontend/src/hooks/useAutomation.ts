import { useState, useEffect, useCallback } from 'react';
import {
  PreparedAction,
  WatchRule,
  NaturalLanguageFilter,
} from '@network-monitor/shared';

export interface UseAutomationReturn {
  pendingActions: PreparedAction[];
  watchRules: WatchRule[];
  isLoading: boolean;
  fetchActions: () => Promise<void>;
  fetchWatchRules: () => Promise<void>;
  confirmAction: (id: string) => Promise<{ success: boolean; result?: any }>;
  dismissAction: (id: string) => Promise<boolean>;
  createWatchRule: (rule: Partial<WatchRule>) => Promise<WatchRule | null>;
  deleteWatchRule: (id: string) => Promise<boolean>;
  parseNlFilter: (query: string) => Promise<NaturalLanguageFilter | null>;
}

export function useAutomation(): UseAutomationReturn {
  const [pendingActions, setPendingActions] = useState<PreparedAction[]>([]);
  const [watchRules, setWatchRules] = useState<WatchRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/automation/actions');
      if (res.ok) {
        const data = await res.json();
        setPendingActions(data.actions || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchWatchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/watch-rules');
      if (res.ok) {
        const data = await res.json();
        setWatchRules(data.rules || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchActions();
    fetchWatchRules();
    const interval = setInterval(() => {
      fetchActions();
      fetchWatchRules();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchActions, fetchWatchRules]);

  const confirmAction = async (id: string): Promise<{ success: boolean; result?: any }> => {
    try {
      const res = await fetch(`/api/automation/actions/${id}/confirm`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await fetchActions();
        return data;
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  };

  const dismissAction = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/automation/actions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchActions();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const createWatchRule = async (rule: Partial<WatchRule>): Promise<WatchRule | null> => {
    try {
      const res = await fetch('/api/automation/watch-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchWatchRules();
        return data;
      }
      return null;
    } catch {
      return null;
    }
  };

  const deleteWatchRule = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/automation/watch-rules/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchWatchRules();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const parseNlFilter = async (query: string): Promise<NaturalLanguageFilter | null> => {
    try {
      const res = await fetch('/api/automation/nl-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  };

  return {
    pendingActions,
    watchRules,
    isLoading,
    fetchActions,
    fetchWatchRules,
    confirmAction,
    dismissAction,
    createWatchRule,
    deleteWatchRule,
    parseNlFilter,
  };
}
