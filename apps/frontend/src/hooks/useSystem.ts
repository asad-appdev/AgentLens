import { useState, useEffect, useCallback } from 'react';
import {
  SystemHealthResponse,
  SystemDiagnosticsReport,
  BackupMetadata,
} from '@network-monitor/shared';

export interface UseSystemReturn {
  health: SystemHealthResponse | null;
  diagnostics: SystemDiagnosticsReport | null;
  backups: BackupMetadata[];
  isPaused: boolean;
  isLoading: boolean;
  togglePause: () => Promise<void>;
  fetchDiagnostics: () => Promise<SystemDiagnosticsReport | null>;
  createBackup: () => Promise<BackupMetadata | null>;
  restoreBackup: (backupId: string) => Promise<boolean>;
  refreshHealth: () => Promise<void>;
  refreshBackups: () => Promise<void>;
}

export function useSystem(): UseSystemReturn {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnosticsReport | null>(null);
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch {
      // Ignore health polling errors
    }
  }, []);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await fetch('/api/system/backup');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch {
      // Ignore backup polling errors
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchBackups();
    const interval = setInterval(fetchHealth, 4000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchBackups]);

  const togglePause = async () => {
    try {
      const endpoint = health?.isPaused ? '/api/system/resume' : '/api/system/pause';
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        await fetchHealth();
      }
    } catch (err) {
      console.warn('Failed to toggle monitoring pause:', err);
    }
  };

  const fetchDiagnostics = async (): Promise<SystemDiagnosticsReport | null> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/diagnostics');
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
        return data;
      }
      return null;
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const createBackup = async (): Promise<BackupMetadata | null> => {
    try {
      const res = await fetch('/api/system/backup', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await fetchBackups();
        return data.backup;
      }
      return null;
    } catch {
      return null;
    }
  };

  const restoreBackup = async (backupId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/system/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId }),
      });
      if (res.ok) {
        await fetchBackups();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return {
    health,
    diagnostics,
    backups,
    isPaused: !!health?.isPaused,
    isLoading,
    togglePause,
    fetchDiagnostics,
    createBackup,
    restoreBackup,
    refreshHealth: fetchHealth,
    refreshBackups: fetchBackups,
  };
}
