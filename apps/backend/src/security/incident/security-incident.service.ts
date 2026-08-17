import {
  SecurityIncident,
  SecurityAlert,
  SecuritySeverity,
} from '@network-monitor/shared';
import { databaseService, DatabaseService } from '../../services/database.service.js';
import { logger } from '../../services/logger.service.js';

export class SecurityIncidentService {
  private readonly db: DatabaseService;
  private incidents = new Map<string, SecurityIncident>();
  private incidentCounter = 1;

  constructor(db: DatabaseService = databaseService) {
    this.db = db;
    this.loadFromDb();
  }

  private loadFromDb(): void {
    const sqlite = this.db.getDatabase();
    if (!sqlite || !this.db.isAvailable()) return;

    try {
      const rows = sqlite.prepare(`
        SELECT * FROM security_incidents ORDER BY created_at DESC LIMIT 100
      `).all() as any[];

      for (const r of rows) {
        const inc: SecurityIncident = {
          id: r.id,
          incidentNumber: r.incident_number,
          title: r.title,
          agentId: r.agent_id || undefined,
          agentName: r.agent_name || undefined,
          rootPid: r.root_pid,
          severity: r.severity as SecuritySeverity,
          riskScore: r.risk_score,
          status: r.status,
          evidence: JSON.parse(r.evidence_json || '[]'),
          correlatedAlertIds: JSON.parse(r.alert_ids_json || '[]'),
          timelineStart: r.timeline_start,
          timelineEnd: r.timeline_end,
          summaryExplanation: r.summary_explanation || undefined,
          actions: JSON.parse(r.actions_json || '[]'),
          createdAt: new Date(r.created_at).toISOString(),
          updatedAt: new Date(r.updated_at).toISOString(),
        };
        this.incidents.set(inc.id, inc);
      }
      this.incidentCounter = this.incidents.size + 1;
    } catch (err) {
      logger.error(`[SecurityIncidentService] Failed to load incidents from DB: ${err}`);
    }
  }

  /**
   * Creates or groups alerts into a Security Incident.
   */
  public createOrUpdateIncidentFromAlert(alert: SecurityAlert): SecurityIncident {
    const existing = Array.from(this.incidents.values()).find(
      (inc) => inc.status === 'OPEN' && inc.agentId === alert.agentId
    );

    const now = new Date().toISOString();

    if (existing) {
      if (!existing.correlatedAlertIds.includes(alert.id)) {
        existing.correlatedAlertIds.push(alert.id);
      }
      existing.evidence.push(...alert.evidence.filter((e) => !existing.evidence.includes(e)));
      existing.timelineEnd = now;
      existing.updatedAt = now;
      if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
        existing.severity = alert.severity;
      }
      this.persistIncident(existing);
      return existing;
    }

    const numStr = String(this.incidentCounter++).padStart(3, '0');
    const newInc: SecurityIncident = {
      id: `inc-${Date.now()}-${numStr}`,
      incidentNumber: `INC-${numStr}`,
      title: `${alert.title} (${alert.agentName || alert.processName})`,
      agentId: alert.agentId,
      agentName: alert.agentName || alert.processName,
      rootPid: alert.pid,
      severity: alert.severity,
      riskScore: alert.severity === 'HIGH' ? 80 : 50,
      status: 'OPEN',
      evidence: [...alert.evidence],
      correlatedAlertIds: [alert.id],
      timelineStart: alert.timestamp,
      timelineEnd: now,
      summaryExplanation: alert.whySuspicious,
      actions: [
        { type: 'INVESTIGATE', label: 'Investigate Incident', targetId: alert.id, requiresConfirmation: false },
        { type: 'KILL_AGENT', label: `Terminate Agent (PID ${alert.pid})`, targetId: String(alert.pid), requiresConfirmation: true, destructive: true },
        { type: 'DISMISS', label: 'Dismiss Incident', targetId: 'dismiss', requiresConfirmation: false },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.incidents.set(newInc.id, newInc);
    this.persistIncident(newInc);
    return newInc;
  }

  private persistIncident(inc: SecurityIncident): void {
    const sqlite = this.db.getDatabase();
    if (!sqlite || !this.db.isAvailable()) return;

    try {
      const stmt = sqlite.prepare(`
        INSERT OR REPLACE INTO security_incidents (
          id, incident_number, title, agent_id, agent_name, root_pid,
          severity, risk_score, status, evidence_json, alert_ids_json,
          timeline_start, timeline_end, summary_explanation, actions_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        inc.id,
        inc.incidentNumber,
        inc.title,
        inc.agentId || null,
        inc.agentName || null,
        inc.rootPid,
        inc.severity,
        inc.riskScore,
        inc.status,
        JSON.stringify(inc.evidence),
        JSON.stringify(inc.correlatedAlertIds),
        inc.timelineStart,
        inc.timelineEnd,
        inc.summaryExplanation || null,
        JSON.stringify(inc.actions),
        new Date(inc.createdAt).getTime(),
        Date.now()
      );
    } catch (err) {
      logger.error(`[SecurityIncidentService] Failed to persist incident: ${err}`);
    }
  }

  /**
   * Retrieves all incidents.
   */
  public getAllIncidents(): SecurityIncident[] {
    return Array.from(this.incidents.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Updates status of an incident.
   */
  public updateStatus(incidentId: string, status: SecurityIncident['status']): boolean {
    const inc = this.incidents.get(incidentId);
    if (inc) {
      inc.status = status;
      inc.updatedAt = new Date().toISOString();
      this.persistIncident(inc);
      return true;
    }
    return false;
  }
}

export const securityIncidentService = new SecurityIncidentService();
