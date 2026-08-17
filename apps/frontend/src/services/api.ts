import {
  HealthResponse,
  ConnectionsResponse,
  SecurityAlert,
  SecurityIncident,
  SecurityEvent,
  SensitiveFileAccess,
  PersistenceMechanism,
  PackageActivityEvent,
  AgentPolicy,
  SecurityInvestigationResult,
} from '@network-monitor/shared';

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed with status: ${response.status}`);
  }
  return response.json();
}

export async function fetchConnections(): Promise<ConnectionsResponse> {
  const response = await fetch('/api/connections');
  if (!response.ok) {
    throw new Error(`Connections fetch failed with status: ${response.status}`);
  }
  return response.json();
}

export async function fetchSecurityAlerts(): Promise<{ count: number; alerts: SecurityAlert[] }> {
  const response = await fetch('/api/security/alerts');
  if (!response.ok) throw new Error('Failed to fetch security alerts');
  return response.json();
}

export async function dismissSecurityAlert(alertId: string): Promise<void> {
  await fetch(`/api/security/alerts/${alertId}/dismiss`, { method: 'POST' });
}

export async function trustSecurityEntity(type: 'domain' | 'ip' | 'process', value: string, reason?: string, alertId?: string): Promise<void> {
  const url = alertId ? `/api/security/alerts/${alertId}/trust` : '/api/security/trusted';
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, value, reason }),
  });
}

export async function fetchSecurityIncidents(): Promise<{ count: number; incidents: SecurityIncident[] }> {
  const response = await fetch('/api/security/incidents');
  if (!response.ok) throw new Error('Failed to fetch security incidents');
  return response.json();
}

export async function fetchSecurityTimeline(params: Record<string, string> = {}): Promise<{ total: number; events: SecurityEvent[] }> {
  const qs = new URLSearchParams(params).toString();
  const response = await fetch(`/api/security/timeline${qs ? `?${qs}` : ''}`);
  if (!response.ok) throw new Error('Failed to fetch security timeline');
  return response.json();
}

export async function fetchSensitiveFiles(): Promise<{ count: number; files: SensitiveFileAccess[] }> {
  const response = await fetch('/api/security/sensitive-files');
  if (!response.ok) throw new Error('Failed to fetch sensitive file access log');
  return response.json();
}

export async function fetchPersistenceItems(): Promise<{ count: number; items: PersistenceMechanism[] }> {
  const response = await fetch('/api/security/persistence');
  if (!response.ok) throw new Error('Failed to fetch persistence items');
  return response.json();
}

export async function fetchPackageActivity(): Promise<{ count: number; events: PackageActivityEvent[] }> {
  const response = await fetch('/api/security/packages');
  if (!response.ok) throw new Error('Failed to fetch package activity');
  return response.json();
}

export async function fetchAgentPolicies(): Promise<{ count: number; policies: AgentPolicy[] }> {
  const response = await fetch('/api/security/policies');
  if (!response.ok) throw new Error('Failed to fetch agent policies');
  return response.json();
}

export async function investigateSecurityTarget(targetId: string, question?: string): Promise<SecurityInvestigationResult> {
  const response = await fetch('/api/security/investigate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId, question }),
  });
  if (!response.ok) throw new Error('Failed to run security investigator');
  return response.json();
}

export async function clearSecurityHistory(): Promise<void> {
  await fetch('/api/security/clear-history', { method: 'POST' });
}
