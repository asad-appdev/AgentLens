import { useState, useEffect, useCallback } from 'react';
import {
  ProcessInspectorDetail,
  ConnectionInspectorDetail,
  RemoteIpInspectorDetail,
  LocalNotificationEvent,
  UserAppSettings,
} from '@network-monitor/shared';

export interface UseIntelligenceReturn {
  settings: UserAppSettings | null;
  events: LocalNotificationEvent[];
  unreadEventCount: number;
  inspectProcess: (pid: number) => Promise<ProcessInspectorDetail | null>;
  inspectConnection: (id: string) => Promise<ConnectionInspectorDetail | null>;
  inspectRemoteIp: (ip: string) => Promise<RemoteIpInspectorDetail | null>;
  toggleFavorite: (pid: number, processName: string) => Promise<boolean>;
  setProcessLabel: (key: string, label?: string) => Promise<void>;
  setTags: (key: string, tags: string[]) => Promise<void>;
  updateSettings: (partial: Partial<UserAppSettings>) => Promise<void>;
  markEventsRead: () => Promise<void>;
  clearEvents: () => Promise<void>;
  refreshEvents: () => Promise<void>;
}

export function useIntelligence(): UseIntelligenceReturn {
  const [settings, setSettings] = useState<UserAppSettings | null>(null);
  const [events, setEvents] = useState<LocalNotificationEvent[]>([]);
  const [unreadEventCount, setUnreadEventCount] = useState(0);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/intelligence/settings');
      if (res.ok) {
        const data: UserAppSettings = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.warn('Failed to fetch intelligence settings:', err);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/intelligence/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setUnreadEventCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.warn('Failed to fetch events:', err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchEvents();
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, [fetchSettings, fetchEvents]);

  const inspectProcess = async (pid: number): Promise<ProcessInspectorDetail | null> => {
    try {
      const res = await fetch(`/api/intelligence/process/${pid}`);
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  };

  const inspectConnection = async (id: string): Promise<ConnectionInspectorDetail | null> => {
    try {
      const res = await fetch(`/api/intelligence/connection/${encodeURIComponent(id)}`);
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  };

  const inspectRemoteIp = async (ip: string): Promise<RemoteIpInspectorDetail | null> => {
    try {
      const res = await fetch(`/api/intelligence/remote-ip/${encodeURIComponent(ip)}`);
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  };

  const toggleFavorite = async (pid: number, processName: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/intelligence/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, processName }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchSettings();
        return data.isFavorite;
      }
      return false;
    } catch {
      return false;
    }
  };

  const setProcessLabel = async (key: string, label?: string): Promise<void> => {
    try {
      await fetch('/api/intelligence/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, label }),
      });
      await fetchSettings();
    } catch (err) {
      console.warn('Error setting process label:', err);
    }
  };

  const setTags = async (key: string, tags: string[]): Promise<void> => {
    try {
      await fetch('/api/intelligence/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, tags }),
      });
      await fetchSettings();
    } catch (err) {
      console.warn('Error setting tags:', err);
    }
  };

  const updateSettings = async (partial: Partial<UserAppSettings>): Promise<void> => {
    try {
      const res = await fetch('/api/intelligence/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (res.ok) {
        const data: UserAppSettings = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.warn('Error updating settings:', err);
    }
  };

  const markEventsRead = async (): Promise<void> => {
    try {
      await fetch('/api/intelligence/events/read', { method: 'POST' });
      setUnreadEventCount(0);
      setEvents((prev) => prev.map((e) => ({ ...e, read: true })));
    } catch (err) {
      console.warn('Error marking events read:', err);
    }
  };

  const clearEvents = async (): Promise<void> => {
    try {
      await fetch('/api/intelligence/events/clear', { method: 'POST' });
      setEvents([]);
      setUnreadEventCount(0);
    } catch (err) {
      console.warn('Error clearing events:', err);
    }
  };

  return {
    settings,
    events,
    unreadEventCount,
    inspectProcess,
    inspectConnection,
    inspectRemoteIp,
    toggleFavorite,
    setProcessLabel,
    setTags,
    updateSettings,
    markEventsRead,
    clearEvents,
    refreshEvents: fetchEvents,
  };
}
