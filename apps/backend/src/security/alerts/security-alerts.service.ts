import {
  SecurityAlert,
  SecuritySeverity,
  SecurityAlertAction,
} from '@network-monitor/shared';
import { databaseService, DatabaseService } from '../../services/database.service.js';
import { logger } from '../../services/logger.service.js';

export class SecurityAlertsService {
  private readonly db: DatabaseService;
  private activeAlerts = new Map<string, SecurityAlert>();

  constructor(db: DatabaseService = databaseService) {
    this.db = db;
    this.loadFromDb();
  }

  private loadFromDb(): void {
    const sqlite = this.db.getDatabase();
    if (!sqlite || !this.db.isAvailable()) return;

    try {
      const rows = sqlite.prepare(`
        SELECT * FROM security_alerts WHERE is_dismissed = 0 ORDER BY created_at DESC LIMIT 200
      `).all() as any[];

      for (const r of rows) {
        const alert: SecurityAlert = {
          id: r.id,
          timestamp: r.timestamp,
          severity: r.severity as SecuritySeverity,
          title: r.title,
          category: r.category,
          agentId: r.agent_id || undefined,
          agentName: r.agent_name || undefined,
          pid: r.pid,
          processName: r.process_name,
          confidence: r.confidence,
          evidence: JSON.parse(r.evidence_json || '[]'),
          whySuspicious: r.why_suspicious,
          whatIsUnknown: r.what_is_unknown,
          recommendation: r.recommendation,
          actions: JSON.parse(r.actions_json || '[]'),
          isDismissed: Boolean(r.is_dismissed),
          isResolved: Boolean(r.is_resolved),
          incidentId: r.incident_id || undefined,
        };
        this.activeAlerts.set(alert.id, alert);
      }
    } catch (err) {
      logger.error(`[SecurityAlertsService] Failed to load alerts from DB: ${err}`);
    }
  }

  /**
   * Creates and registers a new security alert with explicit 5-part evidence explanation.
   */
  public createAlert(alertData: Omit<SecurityAlert, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): SecurityAlert {
    const id = alertData.id || `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = alertData.timestamp || new Date().toISOString();

    const standardActions: SecurityAlertAction[] = [
      {
        type: 'INVESTIGATE',
        label: 'Investigate',
        targetId: id,
        requiresConfirmation: false,
      },
      {
        type: 'KILL_AGENT',
        label: `Kill Agent (PID ${alertData.pid})`,
        targetId: String(alertData.pid),
        requiresConfirmation: true,
        destructive: true,
      },
      {
        type: 'DISMISS',
        label: 'Dismiss',
        targetId: id,
        requiresConfirmation: false,
      },
    ];

    const alert: SecurityAlert = {
      ...alertData,
      id,
      timestamp,
      actions: alertData.actions && alertData.actions.length > 0 ? alertData.actions : standardActions,
      isDismissed: false,
      isResolved: false,
    };

    this.activeAlerts.set(id, alert);

    // Persist to database
    const sqlite = this.db.getDatabase();
    if (sqlite && this.db.isAvailable()) {
      try {
        const stmt = sqlite.prepare(`
          INSERT OR REPLACE INTO security_alerts (
            id, timestamp, severity, title, category, agent_id, agent_name,
            pid, process_name, confidence, evidence_json, why_suspicious,
            what_is_unknown, recommendation, actions_json, is_dismissed,
            is_resolved, incident_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          alert.id,
          alert.timestamp,
          alert.severity,
          alert.title,
          alert.category,
          alert.agentId || null,
          alert.agentName || null,
          alert.pid,
          alert.processName,
          alert.confidence,
          JSON.stringify(alert.evidence),
          alert.whySuspicious,
          alert.whatIsUnknown,
          alert.recommendation,
          JSON.stringify(alert.actions),
          alert.isDismissed ? 1 : 0,
          alert.isResolved ? 1 : 0,
          alert.incidentId || null,
          Date.now()
        );
      } catch (err) {
        logger.error(`[SecurityAlertsService] Failed to persist alert: ${err}`);
      }
    }

    return alert;
  }

  /**
   * Retrieves all active (undismissed) alerts.
   */
  public getActiveAlerts(severity?: SecuritySeverity): SecurityAlert[] {
    let list = Array.from(this.activeAlerts.values()).filter((a) => !a.isDismissed);
    if (severity) {
      list = list.filter((a) => a.severity === severity);
    }
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Dismisses an alert by ID.
   */
  public dismissAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.isDismissed = true;
    const sqlite = this.db.getDatabase();
    if (sqlite && this.db.isAvailable()) {
      try {
        sqlite.prepare('UPDATE security_alerts SET is_dismissed = 1 WHERE id = ?').run(alertId);
      } catch (err) {
        logger.error(`[SecurityAlertsService] Failed to dismiss alert in DB: ${err}`);
      }
    }
    return true;
  }

  /**
   * Clears all alerts.
   */
  public clearAll(): void {
    this.activeAlerts.clear();
  }
}

export const securityAlertsService = new SecurityAlertsService();
