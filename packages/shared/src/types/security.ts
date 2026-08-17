export type SecurityEventType =

  | 'PROCESS_STARTED'
  | 'PROCESS_EXITED'
  | 'FILE_ACCESS'
  | 'FILE_CHANGE'
  | 'NETWORK_CONNECTION'
  | 'NETWORK_CLOSED'
  | 'TRAFFIC_ACTIVITY'
  | 'COMMAND_EXECUTED'
  | 'CHILD_PROCESS_CREATED'
  | 'PACKAGE_INSTALLED'
  | 'PERSISTENCE_CHANGED'
  | 'SECURITY_ALERT'
  | 'DATA_EXPOSURE_RISK'
  | 'INCIDENT_CREATED';

export type SecuritySeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type SensitiveFileCategory =
  | 'credentials'
  | 'ssh'
  | 'cloud'
  | 'git'
  | 'tokens'
  | 'certificates'
  | 'custom';

export type FileSensitivity = 'low' | 'medium' | 'high' | 'critical';

export interface SensitiveFileAccess {
  id: string;
  path: string;
  category: SensitiveFileCategory;
  accessedBy: string; // agentId or process name
  pid: number;
  processName: string;
  timestamp: string;
  sensitivity: FileSensitivity;
  isRedacted: boolean; // Confirms zero secret content was read/stored
}

export interface SecurityRiskFactor {
  id: string;
  delta: number; // e.g. +20, -5
  reason: string;
  evidence: string;
  timestamp: string;
  category?: 'file' | 'network' | 'process' | 'persistence' | 'package' | 'trust';
}

export interface SecurityRiskBreakdown {
  score: number; // 0 - 100
  level: SecuritySeverity;
  factors: SecurityRiskFactor[];
  lastEvaluated: string;
}

export type SecurityAlertActionType =
  | 'INVESTIGATE'
  | 'BLOCK_DESTINATION'
  | 'KILL_AGENT'
  | 'KILL_PROCESS'
  | 'DISMISS'
  | 'MARK_TRUSTED';

export interface SecurityAlertAction {
  type: SecurityAlertActionType;
  label: string;
  targetId: string; // IP, PID, or alertId
  requiresConfirmation: boolean;
  destructive?: boolean;
}

export interface SecurityAlert {
  id: string;
  timestamp: string;
  severity: SecuritySeverity;
  title: string;
  category: 'data_exposure' | 'unusual_process' | 'unseen_destination' | 'persistence' | 'supply_chain' | 'policy_violation';
  agentId?: string;
  agentName?: string;
  pid: number;
  processName: string;
  confidence: number; // 0.0 - 1.0
  evidence: string[];
  whySuspicious: string;
  whatIsUnknown: string;
  recommendation: string;
  actions: SecurityAlertAction[];
  isDismissed?: boolean;
  isResolved?: boolean;
  incidentId?: string;
}

export type SecurityIncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';

export interface SecurityIncident {
  id: string;
  incidentNumber: string; // e.g. "INC-001"
  title: string;
  agentId?: string;
  agentName?: string;
  rootPid: number;
  severity: SecuritySeverity;
  riskScore: number;
  status: SecurityIncidentStatus;
  evidence: string[];
  correlatedAlertIds: string[];
  timelineStart: string;
  timelineEnd: string;
  createdAt: string;
  updatedAt: string;
  summaryExplanation?: string;
  actions: SecurityAlertAction[];
}

export interface AgentSessionTimelineEvent {
  timestamp: string;
  type: SecurityEventType;
  description: string;
  severity?: SecuritySeverity;
  metadata?: Record<string, unknown>;
}

export interface AgentSession {
  sessionId: string;
  agentId: string;
  displayName: string;
  rootPid: number;
  status: 'ACTIVE' | 'IDLE' | 'ENDED';
  startTime: string;
  lastSeen: string;
  endTime?: string;
  filesAccessedCount: number;
  sensitiveFilesCount: number;
  commandsCount: number;
  childProcessesCount: number;
  connectionCount: number;
  uploadBytes: number;
  downloadBytes: number;
  riskScore: number;
  riskFactors: SecurityRiskFactor[];
  timeline: AgentSessionTimelineEvent[];
  observedDestinations: string[];
  childPids: number[];
}

export type PersistencePlatform = 'darwin' | 'win32';
export type PersistenceType =
  | 'launch_agent'
  | 'launch_daemon'
  | 'login_item'
  | 'registry_run'
  | 'scheduled_task'
  | 'windows_service';

export interface PersistenceMechanism {
  id: string;
  platform: PersistencePlatform;
  type: PersistenceType;
  name: string;
  targetPath: string;
  associatedPid?: number;
  associatedAgentId?: string;
  discoveredAt: string;
  isSuspicious: boolean;
  suspicionReason?: string;
}

export type PackageManagerName = 'npm' | 'pip' | 'cargo' | 'go' | 'brew' | 'yarn' | 'pnpm';
export type PackageActionType = 'install' | 'postinstall' | 'build' | 'update';

export interface PackageActivityEvent {
  id: string;
  agentId?: string;
  pid: number;
  processName: string;
  packageManager: PackageManagerName;
  action: PackageActionType;
  packageName?: string;
  spawnedProcess?: string;
  timestamp: string;
  severity: SecuritySeverity;
  description: string;
}

export interface AgentPolicy {
  agentId: string;
  displayName: string;
  allowedDestinations: string[];
  restrictedSensitiveCategories: SensitiveFileCategory[];
  alertOnChildProcessSpawn: boolean;
  alertOnPackageInstall: boolean;
  alertOnPersistenceModification: boolean;
  maxExpectedOutboundMbPerSession: number;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityTimelineFilter {
  agentId?: string;
  pid?: number;
  severity?: SecuritySeverity;
  eventType?: SecurityEventType;
  timeRange?: '15m' | '1h' | '6h' | '24h' | '7d' | '30d' | 'all';
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  agentId?: string;
  agentName?: string;
  pid: number;
  processName: string;
  severity: SecuritySeverity;
  riskDelta?: number;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface SecurityEvidencePackage {
  incidentOrAlertId: string;
  title: string;
  agentId?: string;
  agentName?: string;
  pid: number;
  processName: string;
  timeline: Array<{ timestamp: string; event: string; severity?: string }>;
  processesInvolved: Array<{ pid: number; name: string; command?: string }>;
  networkDestinations: Array<{ host: string; port: number; bytesOut: number; bytesIn: number }>;
  sensitiveResources: Array<{ path: string; category: string; sensitivity: string }>;
  isSanitized: boolean; // Guaranteed no secrets/tokens included
}

export interface SecurityInvestigationResult {
  investigationId: string;
  targetId: string; // Alert or Incident ID
  timestamp: string;
  providerUsed: 'ollama' | 'local-llm' | 'semantic-engine' | 'disabled';
  observedFacts: string[];
  inferences: string[];
  whatCannotBeConfirmed: string[];
  recommendedActions: string[];
  naturalLanguageSummary: string;
}
