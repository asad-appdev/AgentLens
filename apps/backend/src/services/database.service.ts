import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface DatabaseServiceOptions {
  dataDir?: string;
  dbFilename?: string;
  inMemory?: boolean;
}

export class DatabaseService {
  private db: Database.Database | null = null;
  private isDbAvailable = false;
  private readonly dbPath: string;
  private readonly inMemory: boolean;

  constructor(options: DatabaseServiceOptions = {}) {
    this.inMemory = !!options.inMemory;
    const dataDir = options.dataDir ?? path.join(os.homedir(), '.network-monitor');
    const filename = options.dbFilename ?? 'history.db';
    this.dbPath = this.inMemory ? ':memory:' : path.join(dataDir, filename);

    this.initialize(dataDir);
  }

  private initialize(dataDir: string): void {
    try {
      if (!this.inMemory && !fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new Database(this.dbPath);

      if (!this.inMemory) {
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
      }

      this.createTables();
      this.isDbAvailable = true;
    } catch (err) {
      this.isDbAvailable = false;
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[DatabaseService] SQLite history storage unavailable:`, err);
      }
    }
  }

  public getDatabase(): Database.Database | null {
    return this.db;
  }

  public isAvailable(): boolean {
    return this.isDbAvailable && this.db !== null;
  }

  public getDatabaseSizeBytes(): number {
    if (this.inMemory || !this.dbPath || !fs.existsSync(this.dbPath)) return 0;
    try {
      const stat = fs.statSync(this.dbPath);
      return stat.size;
    } catch {
      return 0;
    }
  }

  public getDatabasePath(): string {
    return this.dbPath;
  }

  public getSchemaVersion(): number {
    if (!this.db || !this.isDbAvailable) return 1;
    try {
      const res = this.db.pragma('user_version', { simple: true }) as number;
      return res || 1;
    } catch {
      return 1;
    }
  }

  public close(): void {
    if (this.db) {
      try {
        this.db.close();
      } catch {
        // ignore close errors
      }
      this.db = null;
      this.isDbAvailable = false;
    }
  }

  private createTables(): void {
    if (!this.db) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS process_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        pid INTEGER NOT NULL,
        process_name TEXT NOT NULL,
        command TEXT,
        cpu_percent REAL DEFAULT 0,
        memory_bytes INTEGER DEFAULT 0,
        is_ai_agent INTEGER DEFAULT 0,
        ai_agent_name TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS connection_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        pid INTEGER NOT NULL,
        process_name TEXT NOT NULL,
        protocol TEXT NOT NULL,
        local_address TEXT,
        local_port INTEGER,
        remote_address TEXT,
        remote_port INTEGER,
        state TEXT,
        is_ai_agent INTEGER DEFAULT 0,
        ai_agent_name TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS traffic_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        pid INTEGER NOT NULL,
        process_name TEXT NOT NULL,
        bytes_in_rate INTEGER NOT NULL,
        bytes_out_rate INTEGER NOT NULL,
        total_rate INTEGER NOT NULL,
        is_ai_agent INTEGER DEFAULT 0,
        ai_agent_name TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS firewall_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        ip TEXT NOT NULL,
        family TEXT,
        success INTEGER NOT NULL,
        error_code TEXT,
        details_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS process_control_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        pid INTEGER NOT NULL,
        process_name TEXT,
        signal TEXT,
        success INTEGER NOT NULL,
        error_code TEXT,
        details_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS security_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        agent_id TEXT,
        agent_name TEXT,
        pid INTEGER NOT NULL,
        process_name TEXT NOT NULL,
        severity TEXT NOT NULL,
        risk_delta INTEGER DEFAULT 0,
        description TEXT NOT NULL,
        metadata_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS security_alerts (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        agent_id TEXT,
        agent_name TEXT,
        pid INTEGER NOT NULL,
        process_name TEXT NOT NULL,
        confidence REAL NOT NULL,
        evidence_json TEXT NOT NULL,
        why_suspicious TEXT NOT NULL,
        what_is_unknown TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        actions_json TEXT NOT NULL,
        is_dismissed INTEGER DEFAULT 0,
        is_resolved INTEGER DEFAULT 0,
        incident_id TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS security_incidents (
        id TEXT PRIMARY KEY,
        incident_number TEXT NOT NULL,
        title TEXT NOT NULL,
        agent_id TEXT,
        agent_name TEXT,
        root_pid INTEGER NOT NULL,
        severity TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        status TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        alert_ids_json TEXT NOT NULL,
        timeline_start TEXT NOT NULL,
        timeline_end TEXT NOT NULL,
        summary_explanation TEXT,
        actions_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agent_sessions (
        session_id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        root_pid INTEGER NOT NULL,
        status TEXT NOT NULL,
        start_time TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        end_time TEXT,
        files_accessed INTEGER DEFAULT 0,
        sensitive_files INTEGER DEFAULT 0,
        commands INTEGER DEFAULT 0,
        child_processes INTEGER DEFAULT 0,
        connections INTEGER DEFAULT 0,
        upload_bytes INTEGER DEFAULT 0,
        download_bytes INTEGER DEFAULT 0,
        risk_score INTEGER DEFAULT 0,
        risk_factors_json TEXT,
        timeline_json TEXT,
        destinations_json TEXT,
        child_pids_json TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sensitive_file_accesses (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        category TEXT NOT NULL,
        accessed_by TEXT NOT NULL,
        pid INTEGER NOT NULL,
        process_name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        sensitivity TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trusted_entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        reason TEXT,
        added_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_proc_hist_created ON process_history(created_at, pid);
      CREATE INDEX IF NOT EXISTS idx_proc_hist_created_desc ON process_history(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_proc_hist_ai ON process_history(is_ai_agent, created_at);
      CREATE INDEX IF NOT EXISTS idx_conn_hist_created ON connection_history(created_at, pid);
      CREATE INDEX IF NOT EXISTS idx_conn_hist_created_desc ON connection_history(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_conn_hist_remote ON connection_history(remote_address, created_at);
      CREATE INDEX IF NOT EXISTS idx_conn_hist_ai ON connection_history(is_ai_agent, created_at);
      CREATE INDEX IF NOT EXISTS idx_traffic_hist_created ON traffic_history(created_at, pid);
      CREATE INDEX IF NOT EXISTS idx_traffic_hist_created_desc ON traffic_history(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_traffic_hist_ai ON traffic_history(is_ai_agent, created_at);
      CREATE INDEX IF NOT EXISTS idx_fw_events_created ON firewall_events(created_at);
      CREATE INDEX IF NOT EXISTS idx_sec_events_created ON security_events(created_at, agent_id);
      CREATE INDEX IF NOT EXISTS idx_sec_alerts_created ON security_alerts(created_at, severity);
      CREATE INDEX IF NOT EXISTS idx_sec_incidents_created ON security_incidents(created_at, status);
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_created ON agent_sessions(created_at, agent_id);
      CREATE INDEX IF NOT EXISTS idx_sens_files_created ON sensitive_file_accesses(created_at, category);
    `);

  }
}

export const databaseService = new DatabaseService();
