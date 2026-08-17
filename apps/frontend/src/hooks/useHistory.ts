import { useState, useEffect, useCallback, useRef } from 'react';
import {
  HistorySummary,
  TrafficTimelineBucket,
  HistoryStatus,
  HistoryTimeRange,
  TopRemoteIpStat,
} from '@network-monitor/shared';

export interface UseHistoryReturn {
  summary: HistorySummary | null;
  timeline: TrafficTimelineBucket[];
  status: HistoryStatus | null;
  topIps: TopRemoteIpStat[];
  timeRange: HistoryTimeRange;
  setTimeRange: (range: HistoryTimeRange) => void;
  isLoading: boolean;
  isStreaming: boolean;
  lastUpdated: Date | null;
  error: string | null;
  toggleRecording: (enabled: boolean) => Promise<boolean>;
  clearHistory: (olderThanHours?: number) => Promise<boolean>;
  refreshHistory: () => Promise<void>;
}

export function useHistory(pollIntervalMs: number = 2500): UseHistoryReturn {
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [timeline, setTimeline] = useState<TrafficTimelineBucket[]>([]);
  const [status, setStatus] = useState<HistoryStatus | null>(null);
  const [topIps, setTopIps] = useState<TopRemoteIpStat[]>([]);
  const [timeRange, setTimeRange] = useState<HistoryTimeRange>('1h');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isInitialLoadRef = useRef(true);

  const fetchHistory = useCallback(async (isSilent = false) => {
    if (!isSilent && isInitialLoadRef.current) {
      setIsLoading(true);
    }
    setError(null);
    try {
      // 1. Fetch Summary
      const summaryRes = await fetch(`/api/history/summary?range=${timeRange}`);
      if (summaryRes.ok) {
        const sumData: HistorySummary = await summaryRes.json();
        setSummary(sumData);
      }

      // 2. Fetch Timeline (Request 30 buckets for smooth real-time resolution)
      const timelineRes = await fetch(`/api/history/timeline?range=${timeRange}&buckets=30`);
      if (timelineRes.ok) {
        const tlData = await timelineRes.json();
        setTimeline(tlData.timeline || []);
      }

      // 3. Fetch Status
      const statusRes = await fetch('/api/history/status');
      if (statusRes.ok) {
        const stData: HistoryStatus = await statusRes.json();
        setStatus(stData);
      }

      // 4. Fetch Top IPs
      const ipsRes = await fetch(`/api/history/top-ips?range=${timeRange}&limit=10`);
      if (ipsRes.ok) {
        const ipsData = await ipsRes.json();
        setTopIps(ipsData.topIps || []);
      }

      setLastUpdated(new Date());
      isInitialLoadRef.current = false;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching history';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  // Initial and range change fetch
  useEffect(() => {
    fetchHistory(false);
  }, [fetchHistory]);

  // Real-time polling loop
  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    const timer = setInterval(() => {
      fetchHistory(true);
    }, pollIntervalMs);

    return () => clearInterval(timer);
  }, [fetchHistory, pollIntervalMs]);

  const toggleRecording = async (enabled: boolean): Promise<boolean> => {
    try {
      const res = await fetch('/api/history/toggle-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        await fetchHistory(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const clearHistory = async (olderThanHours?: number): Promise<boolean> => {
    try {
      const res = await fetch('/api/history/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanHours }),
      });
      if (res.ok) {
        await fetchHistory(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    summary,
    timeline,
    status,
    topIps,
    timeRange,
    setTimeRange,
    isLoading,
    isStreaming: pollIntervalMs > 0,
    lastUpdated,
    error,
    toggleRecording,
    clearHistory,
    refreshHistory: () => fetchHistory(false),
  };
}
