import { useState, useEffect, useCallback } from 'react';
import {
  AiAgentProfile,
  AiAgentSession,
  NetworkRelationshipGraphData,
  BehaviorIndicator,
  SmartFirewallSuggestion,
  InvestigationWorkspace,
} from '@network-monitor/shared';

export interface UseAiIntelligenceReturn {
  profiles: AiAgentProfile[];
  activeSessions: AiAgentSession[];
  graphData: NetworkRelationshipGraphData | null;
  indicators: BehaviorIndicator[];
  suggestions: SmartFirewallSuggestion[];
  investigations: InvestigationWorkspace[];
  isLoading: boolean;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  fetchProfiles: () => Promise<void>;
  fetchGraph: (agentId?: string) => Promise<NetworkRelationshipGraphData | null>;
  fetchIndicators: () => Promise<void>;
  fetchSuggestions: () => Promise<void>;
  updateSuggestionStatus: (id: string, status: SmartFirewallSuggestion['status']) => Promise<boolean>;
  fetchInvestigations: () => Promise<void>;
  createInvestigation: (title: string, description?: string) => Promise<InvestigationWorkspace | null>;
  pinToInvestigation: (investigationId: string, item: { type: any; targetId: string; title: string; metadata?: any }) => Promise<boolean>;
  addInvestigationNote: (investigationId: string, text: string) => Promise<boolean>;
  deleteInvestigation: (id: string) => Promise<boolean>;
  refreshAll: () => Promise<void>;
}

export function useAiIntelligence(): UseAiIntelligenceReturn {
  const [profiles, setProfiles] = useState<AiAgentProfile[]>([]);
  const [activeSessions, setActiveSessions] = useState<AiAgentSession[]>([]);
  const [graphData, setGraphData] = useState<NetworkRelationshipGraphData | null>(null);
  const [indicators, setIndicators] = useState<BehaviorIndicator[]>([]);
  const [suggestions, setSuggestions] = useState<SmartFirewallSuggestion[]>([]);
  const [investigations, setInvestigations] = useState<InvestigationWorkspace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-agents');
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.agents || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSessions = useCallback(async (agentId?: string) => {
    try {
      if (!agentId) return;
      const res = await fetch(`/api/ai-agents/${agentId}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setActiveSessions(data.sessions || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchGraph = useCallback(async (agentId?: string): Promise<NetworkRelationshipGraphData | null> => {
    try {
      const url = agentId ? `/api/ai-agents/${agentId}/graph` : '/api/ai-agents/ollama/graph';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const fetchIndicators = useCallback(async () => {
    try {
      const res = await fetch('/api/intelligence/indicators');
      if (res.ok) {
        const data = await res.json();
        setIndicators(data.indicators || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/intelligence/suggestions');
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchInvestigations = useCallback(async () => {
    try {
      const res = await fetch('/api/investigations');
      if (res.ok) {
        const data = await res.json();
        setInvestigations(data.investigations || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([
      fetchProfiles(),
      fetchSessions(selectedAgentId || undefined),
      fetchGraph(selectedAgentId || undefined),
      fetchIndicators(),
      fetchSuggestions(),
      fetchInvestigations(),
    ]);
    setIsLoading(false);
  }, [fetchProfiles, fetchSessions, fetchGraph, fetchIndicators, fetchSuggestions, fetchInvestigations, selectedAgentId]);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 5000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const updateSuggestionStatus = async (id: string, status: SmartFirewallSuggestion['status']): Promise<boolean> => {
    try {
      const res = await fetch(`/api/intelligence/suggestions/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await fetchSuggestions();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const createInvestigation = async (title: string, description = ''): Promise<InvestigationWorkspace | null> => {
    try {
      const res = await fetch('/api/investigations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      if (res.ok) {
        const ws = await res.json();
        await fetchInvestigations();
        return ws;
      }
      return null;
    } catch {
      return null;
    }
  };

  const pinToInvestigation = async (
    investigationId: string,
    item: { type: any; targetId: string; title: string; metadata?: any }
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/investigations/${investigationId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        await fetchInvestigations();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const addInvestigationNote = async (investigationId: string, text: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/investigations/${investigationId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        await fetchInvestigations();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const deleteInvestigation = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/investigations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchInvestigations();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    profiles,
    activeSessions,
    graphData,
    indicators,
    suggestions,
    investigations,
    isLoading,
    selectedAgentId,
    setSelectedAgentId,
    fetchProfiles,
    fetchGraph,
    fetchIndicators,
    fetchSuggestions,
    updateSuggestionStatus,
    fetchInvestigations,
    createInvestigation,
    pinToInvestigation,
    addInvestigationNote,
    deleteInvestigation,
    refreshAll,
  };
}
