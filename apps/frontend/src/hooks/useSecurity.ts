import { useState, useEffect, useCallback } from 'react';
import {
  SecurityAlert,
  SecurityIncident,
  SecurityEvent,
  SensitiveFileAccess,
  PersistenceMechanism,
  PackageActivityEvent,
} from '@network-monitor/shared';
import {
  fetchSecurityAlerts,
  fetchSecurityIncidents,
  fetchSecurityTimeline,
  fetchSensitiveFiles,
  fetchPersistenceItems,
  fetchPackageActivity,
  dismissSecurityAlert,
  clearSecurityHistory,
} from '../services/api.js';

export function useSecurity(pollIntervalMs = 3000) {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<SecurityEvent[]>([]);
  const [sensitiveFiles, setSensitiveFiles] = useState<SensitiveFileAccess[]>([]);
  const [persistenceItems, setPersistenceItems] = useState<PersistenceMechanism[]>([]);
  const [packageEvents, setPackageEvents] = useState<PackageActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [alertsRes, incidentsRes, timelineRes, filesRes, persRes, pkgRes] = await Promise.allSettled([
        fetchSecurityAlerts(),
        fetchSecurityIncidents(),
        fetchSecurityTimeline({ limit: '50' }),
        fetchSensitiveFiles(),
        fetchPersistenceItems(),
        fetchPackageActivity(),
      ]);

      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.alerts);
      if (incidentsRes.status === 'fulfilled') setIncidents(incidentsRes.value.incidents);
      if (timelineRes.status === 'fulfilled') setTimelineEvents(timelineRes.value.events);
      if (filesRes.status === 'fulfilled') setSensitiveFiles(filesRes.value.files);
      if (persRes.status === 'fulfilled') setPersistenceItems(persRes.value.items);
      if (pkgRes.status === 'fulfilled') setPackageEvents(pkgRes.value.events);

      setLastUpdated(new Date().toISOString());
    } catch {
      // ignore poll error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    refresh();
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs]);

  const dismissAlert = async (id: string) => {
    await dismissSecurityAlert(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const clearHistory = async () => {
    await clearSecurityHistory();
    setAlerts([]);
    setIncidents([]);
    setTimelineEvents([]);
    setSensitiveFiles([]);
  };

  const highAlertsCount = alerts.filter((a) => a.severity === 'HIGH' || a.severity === 'CRITICAL').length;
  const dataExposureCount = alerts.filter((a) => a.category === 'data_exposure').length;

  return {
    alerts,
    incidents,
    timelineEvents,
    sensitiveFiles,
    persistenceItems,
    packageEvents,
    highAlertsCount,
    dataExposureCount,
    isLoading,
    lastUpdated,
    refresh,
    dismissAlert,
    clearHistory,
  };
}
