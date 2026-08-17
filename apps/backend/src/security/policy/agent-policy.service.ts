import { AgentPolicy } from '@network-monitor/shared';
import { databaseService, DatabaseService } from '../../services/database.service.js';
import { logger } from '../../services/logger.service.js';

export interface TrustedEntityRecord {
  id: string;
  type: 'domain' | 'ip' | 'process';
  value: string;
  reason?: string;
  addedAt: string;
}

export class AgentPolicyService {
  private readonly db: DatabaseService;
  private policies = new Map<string, AgentPolicy>();
  private trustedEntities = new Map<string, TrustedEntityRecord>();

  constructor(db: DatabaseService = databaseService) {
    this.db = db;
    this.initDefaultPolicies();
    this.loadTrustedFromDb();
  }

  private initDefaultPolicies(): void {
    const defaultPolicies: AgentPolicy[] = [
      {
        agentId: 'claude-code',
        displayName: 'Claude Code',
        allowedDestinations: ['api.anthropic.com', 'claude.ai', 'github.com', 'registry.npmjs.org'],
        restrictedSensitiveCategories: ['credentials', 'ssh', 'cloud', 'certificates'],
        alertOnChildProcessSpawn: true,
        alertOnPackageInstall: true,
        alertOnPersistenceModification: true,
        maxExpectedOutboundMbPerSession: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        agentId: 'gemini-cli',
        displayName: 'Gemini CLI',
        allowedDestinations: ['generativelanguage.googleapis.com', 'aiplatform.googleapis.com', 'github.com'],
        restrictedSensitiveCategories: ['credentials', 'ssh', 'cloud', 'certificates'],
        alertOnChildProcessSpawn: true,
        alertOnPackageInstall: true,
        alertOnPersistenceModification: true,
        maxExpectedOutboundMbPerSession: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        agentId: 'ollama',
        displayName: 'Ollama',
        allowedDestinations: ['ollama.com', 'ollama.ai', 'huggingface.co', '127.0.0.1', 'localhost'],
        restrictedSensitiveCategories: ['credentials', 'ssh', 'cloud', 'certificates'],
        alertOnChildProcessSpawn: true,
        alertOnPackageInstall: false,
        alertOnPersistenceModification: true,
        maxExpectedOutboundMbPerSession: 5000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    for (const p of defaultPolicies) {
      this.policies.set(p.agentId, p);
    }
  }

  private loadTrustedFromDb(): void {
    const sqlite = this.db.getDatabase();
    if (!sqlite || !this.db.isAvailable()) return;

    try {
      const rows = sqlite.prepare('SELECT * FROM trusted_entities').all() as any[];
      for (const r of rows) {
        this.trustedEntities.set(r.id, {
          id: r.id,
          type: r.type,
          value: r.value,
          reason: r.reason,
          addedAt: new Date(r.added_at).toISOString(),
        });
      }
    } catch (err) {
      logger.error(`[AgentPolicyService] Failed to load trusted entities: ${err}`);
    }
  }

  public getPolicies(): AgentPolicy[] {
    return Array.from(this.policies.values());
  }

  public getPolicy(agentId: string): AgentPolicy | undefined {
    return this.policies.get(agentId);
  }

  public updatePolicy(policy: AgentPolicy): AgentPolicy {
    policy.updatedAt = new Date().toISOString();
    this.policies.set(policy.agentId, policy);
    return policy;
  }

  public addTrustedEntity(type: 'domain' | 'ip' | 'process', value: string, reason?: string): TrustedEntityRecord {
    const id = `trust-${type}-${value.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const record: TrustedEntityRecord = {
      id,
      type,
      value,
      reason: reason || 'User explicitly marked as trusted',
      addedAt: new Date().toISOString(),
    };

    this.trustedEntities.set(id, record);

    const sqlite = this.db.getDatabase();
    if (sqlite && this.db.isAvailable()) {
      try {
        sqlite.prepare(`
          INSERT OR REPLACE INTO trusted_entities (id, type, value, reason, added_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(record.id, record.type, record.value, record.reason || null, Date.now());
      } catch (err) {
        logger.error(`[AgentPolicyService] Failed to persist trusted entity: ${err}`);
      }
    }

    return record;
  }

  public removeTrustedEntity(id: string): boolean {
    const res = this.trustedEntities.delete(id);
    const sqlite = this.db.getDatabase();
    if (sqlite && this.db.isAvailable()) {
      try {
        sqlite.prepare('DELETE FROM trusted_entities WHERE id = ?').run(id);
      } catch (err) {
        logger.error(`[AgentPolicyService] Failed to delete trusted entity: ${err}`);
      }
    }
    return res;
  }

  public getTrustedEntities(): TrustedEntityRecord[] {
    return Array.from(this.trustedEntities.values());
  }

  public isTrusted(type: 'domain' | 'ip' | 'process', value: string): boolean {
    const valLower = value.toLowerCase();
    for (const rec of this.trustedEntities.values()) {
      if (rec.type === type && rec.value.toLowerCase() === valLower) {
        return true;
      }
    }
    return false;
  }
}

export const agentPolicyService = new AgentPolicyService();
