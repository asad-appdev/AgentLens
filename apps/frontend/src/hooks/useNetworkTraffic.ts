import { useState, useEffect, useCallback } from 'react';
import { ProcessTraffic, TrafficSummary } from '@network-monitor/shared';

export type TrafficFilter = 'ALL' | 'ACTIVE' | 'IDLE' | 'AI_AGENTS';
export type TrafficSortField = 'download' | 'upload' | 'total' | 'activity' | 'process' | 'pid';
export type SortDirection = 'asc' | 'desc';

export interface UseNetworkTrafficReturn {
  trafficSummary: TrafficSummary | null;
  processes: ProcessTraffic[];
  filteredProcesses: ProcessTraffic[];
  activeCount: number;
  totalInRate: number;
  totalOutRate: number;
  filter: TrafficFilter;
  setFilter: (filter: TrafficFilter) => void;
  sortField: TrafficSortField;
  sortDirection: SortDirection;
  setSort: (field: TrafficSortField, direction?: SortDirection) => void;
  selectedProcess: ProcessTraffic | null;
  setSelectedProcess: (p: ProcessTraffic | null) => void;
  refreshTraffic: () => Promise<void>;
  isLoading: boolean;
}

export function useNetworkTraffic(pollIntervalMs = 2000): UseNetworkTrafficReturn {
  const [trafficSummary, setTrafficSummary] = useState<TrafficSummary | null>(null);
  const [filter, setFilter] = useState<TrafficFilter>('ALL');
  const [sortField, setSortField] = useState<TrafficSortField>('download');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedProcess, setSelectedProcess] = useState<ProcessTraffic | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTraffic = useCallback(async () => {
    try {
      const res = await fetch('/api/traffic');
      if (!res.ok) return;
      const data: TrafficSummary = await res.json();
      setTrafficSummary(data);

      // Update selected process reference if open
      if (selectedProcess) {
        const updated = data.processes.find((p) => p.pid === selectedProcess.pid);
        if (updated) setSelectedProcess(updated);
      }
    } catch (err) {
      console.warn('Failed to fetch traffic summary:', err);
    }
  }, [selectedProcess]);

  const refreshTraffic = async () => {
    setIsLoading(true);
    await fetchTraffic();
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTraffic();
    const interval = setInterval(fetchTraffic, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchTraffic, pollIntervalMs]);

  const processes = trafficSummary?.processes || [];

  // Filter processes
  const filteredProcesses = processes.filter((p) => {
    switch (filter) {
      case 'ACTIVE':
        return p.activity === 'ACTIVE';
      case 'IDLE':
        return p.activity === 'IDLE';
      case 'AI_AGENTS':
        return p.isAiAgent === true;
      default:
        return true;
    }
  });

  // Sort processes
  filteredProcesses.sort((a, b) => {
    let diff = 0;
    switch (sortField) {
      case 'download':
        diff = a.bytesInPerSecond - b.bytesInPerSecond;
        break;
      case 'upload':
        diff = a.bytesOutPerSecond - b.bytesOutPerSecond;
        break;
      case 'total':
        diff = a.totalBytesPerSecond - b.totalBytesPerSecond;
        break;
      case 'activity':
        diff = (a.activity === 'ACTIVE' ? 1 : 0) - (b.activity === 'ACTIVE' ? 1 : 0);
        break;
      case 'process':
        diff = a.processName.localeCompare(b.processName);
        break;
      case 'pid':
        diff = a.pid - b.pid;
        break;
    }
    return sortDirection === 'desc' ? -diff : diff;
  });

  const setSort = (field: TrafficSortField, direction?: SortDirection) => {
    if (field === sortField && !direction) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection(direction || 'desc');
    }
  };

  return {
    trafficSummary,
    processes,
    filteredProcesses,
    activeCount: trafficSummary?.activeProcesses || 0,
    totalInRate: trafficSummary?.totalBytesInPerSecond || 0,
    totalOutRate: trafficSummary?.totalBytesOutPerSecond || 0,
    filter,
    setFilter,
    sortField,
    sortDirection,
    setSort,
    selectedProcess,
    setSelectedProcess,
    refreshTraffic,
    isLoading,
  };
}
