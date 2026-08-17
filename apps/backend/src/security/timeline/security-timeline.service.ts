import {
  SecurityEvent,
  SecurityTimelineFilter,
} from '@network-monitor/shared';
import { databaseService, DatabaseService } from '../../services/database.service.js';

import { logger } from '../../services/logger.service.js';

export class SecurityTimelineService {
  private readonly db: DatabaseService;
  private inMemoryEvents: SecurityEvent[] = [];
  private maxInMemory = 1000;

  constructor(db: DatabaseService = databaseService) {
    this.db = db;
  }

  /**
   * Records a security event to database and in-memory buffer.
   */
  public recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): SecurityEvent {
    const fullEvent: SecurityEvent = {
      id: event.id || `sec-evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: event.timestamp || new Date().toISOString(),
      type: event.type,
      agentId: event.agentId,
      agentName: event.agentName,
      pid: event.pid,
      processName: event.processName,
      severity: event.severity,
      riskDelta: event.riskDelta || 0,
      description: event.description,
      metadata: event.metadata,
    };

    // Store in-memory
    this.inMemoryEvents.unshift(fullEvent);
    if (this.inMemoryEvents.length > this.maxInMemory) {
      this.inMemoryEvents = this.inMemoryEvents.slice(0, this.maxInMemory);
    }

    // Persist to SQLite if available
    const sqlite = this.db.getDatabase();
    if (sqlite && this.db.isAvailable()) {
      try {
        const stmt = sqlite.prepare(`
          INSERT INTO security_events (
            id, timestamp, type, agent_id, agent_name, pid, process_name,
            severity, risk_delta, description, metadata_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          fullEvent.id,
          fullEvent.timestamp,
          fullEvent.type,
          fullEvent.agentId || null,
          fullEvent.agentName || null,
          fullEvent.pid,
          fullEvent.processName,
          fullEvent.severity,
          fullEvent.riskDelta || 0,
          fullEvent.description,
          fullEvent.metadata ? JSON.stringify(fullEvent.metadata) : null,
          Date.now()
        );
      } catch (err) {
        logger.error(`[SecurityTimelineService] Failed to persist event: ${err}`);
      }
    }

    return fullEvent;
  }

  /**
   * Queries security timeline with structured filters.
   */
  public queryTimeline(filter: SecurityTimelineFilter = {}): { total: number; events: SecurityEvent[] } {
    const sqlite = this.db.getDatabase();
    const limit = filter.limit || 100;
    const offset = filter.offset || 0;

    if (sqlite && this.db.isAvailable()) {
      try {
        const conditions: string[] = [];
        const params: any[] = [];

        if (filter.agentId) {
          conditions.push('agent_id = ?');
          params.push(filter.agentId);
        }
        if (filter.pid) {
          conditions.push('pid = ?');
          params.push(filter.pid);
        }
        if (filter.severity) {
          conditions.push('severity = ?');
          params.push(filter.severity);
        }
        if (filter.eventType) {
          conditions.push('type = ?');
          params.push(filter.eventType);
        }
        if (filter.searchQuery) {
          conditions.push('(description LIKE ? OR process_name LIKE ?)');
          params.push(`%${filter.searchQuery}%`, `%${filter.searchQuery}%`);
        }

        if (filter.timeRange && filter.timeRange !== 'all') {
          const now = Date.now();
          const msMap: Record<string, number> = {
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
          };
          const cutoff = now - (msMap[filter.timeRange] || 3600000);
          conditions.push('created_at >= ?');
          params.push(cutoff);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countStmt = sqlite.prepare(`SELECT COUNT(*) as total FROM security_events ${whereClause}`);
        const total = (countStmt.get(...params) as any)?.total || 0;

        const dataStmt = sqlite.prepare(`
          SELECT * FROM security_events ${whereClause}
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `);
        const rows = dataStmt.all(...params, limit, offset) as any[];

        const events: SecurityEvent[] = rows.map((r) => ({
          id: r.id,
          timestamp: r.timestamp,
          type: r.type,
          agentId: r.agent_id || undefined,
          agentName: r.agent_name || undefined,
          pid: r.pid,
          processName: r.process_name,
          severity: r.severity,
          riskDelta: r.risk_delta,
          description: r.description,
          metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
        }));

        return { total, events };
      } catch (err) {
        logger.error(`[SecurityTimelineService] DB query failed, falling back to memory: ${err}`);
      }
    }

    // In-memory fallback
    let filtered = [...this.inMemoryEvents];
    if (filter.agentId) filtered = filtered.filter((e) => e.agentId === filter.agentId);
    if (filter.pid) filtered = filtered.filter((e) => e.pid === filter.pid);
    if (filter.severity) filtered = filtered.filter((e) => e.severity === filter.severity);
    if (filter.eventType) filtered = filtered.filter((e) => e.type === filter.eventType);
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      filtered = filtered.filter((e) => e.description.toLowerCase().includes(q) || e.processName.toLowerCase().includes(q));
    }

    const total = filtered.length;
    return { total, events: filtered.slice(offset, offset + limit) };
  }

  /**
   * Cleans old security history beyond retention days.
   */
  public purgeOldHistory(retentionDays = 30): number {
    const sqlite = this.db.getDatabase();
    if (!sqlite || !this.db.isAvailable()) return 0;

    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    try {
      const stmt = sqlite.prepare('DELETE FROM security_events WHERE created_at < ?');
      const res = stmt.run(cutoff);
      return res.changes;
    } catch {
      return 0;
    }
  }

  /**
   * Clears ALL security history (events, alerts, sessions, files).
   */
  public clearAllSecurityData(): void {
    this.inMemoryEvents = [];
    const sqlite = this.db.getDatabase();
    if (sqlite && this.db.isAvailable()) {
      try {
        sqlite.exec(`
          DELETE FROM security_events;
          DELETE FROM security_alerts;
          DELETE FROM security_incidents;
          DELETE FROM agent_sessions;
          DELETE FROM sensitive_file_accesses;
        `);
      } catch (err) {
        logger.error(`[SecurityTimelineService] Failed to clear tables: ${err}`);
      }
    }
  }
}

export const securityTimelineService = new SecurityTimelineService();
