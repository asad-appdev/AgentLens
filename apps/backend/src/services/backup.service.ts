import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BackupMetadata, APP_VERSION } from '@network-monitor/shared';
import { DatabaseService, databaseService } from './database.service.js';
import { SettingsService, settingsService } from './settings.service.js';
import { LoggerService, logger } from './logger.service.js';

export class BackupService {
  private readonly backupDir: string;
  private readonly dbService: DatabaseService;
  private readonly settings: SettingsService;
  private readonly logger: LoggerService;

  constructor(
    customDir?: string,
    dbService: DatabaseService = databaseService,
    settings: SettingsService = settingsService,
    loggerService: LoggerService = logger
  ) {
    this.backupDir = customDir ?? path.join(os.homedir(), '.network-monitor', 'backups');
    this.dbService = dbService;
    this.settings = settings;
    this.logger = loggerService;
    this.ensureBackupDir();
  }

  public listBackups(): BackupMetadata[] {
    try {
      this.ensureBackupDir();
      const files = fs.readdirSync(this.backupDir).filter((f) => f.endsWith('.bak.json'));
      const list: BackupMetadata[] = [];

      for (const file of files) {
        const fullPath = path.join(this.backupDir, file);
        try {
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
          list.push({
            id: content.id || file.replace('.bak.json', ''),
            timestamp: content.timestamp || new Date().toISOString(),
            appVersion: content.appVersion || '1.0.0',
            schemaVersion: content.schemaVersion || 1,
            databaseSizeBytes: content.databaseSizeBytes || 0,
            settingsIncluded: !!content.settings,
            filePath: fullPath,
          });
        } catch {
          // Ignore malformed backup files
        }
      }

      return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch {
      return [];
    }
  }

  public createBackup(): BackupMetadata {
    this.ensureBackupDir();
    const timestamp = new Date().toISOString();
    const id = `backup-${Date.now()}`;
    const filePath = path.join(this.backupDir, `${id}.bak.json`);

    const dbPath = this.dbService.getDatabasePath();
    let dbSize = 0;
    if (fs.existsSync(dbPath)) {
      dbSize = fs.statSync(dbPath).size;
    }

    const payload = {
      id,
      timestamp,
      appVersion: APP_VERSION,
      schemaVersion: this.dbService.getSchemaVersion(),
      databaseSizeBytes: dbSize,
      settings: this.settings.getSettings(),
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    this.logger.info(`[BackupService] Created backup snapshot: ${filePath}`);

    return {
      id,
      timestamp,
      appVersion: APP_VERSION,
      schemaVersion: payload.schemaVersion,
      databaseSizeBytes: dbSize,
      settingsIncluded: true,
      filePath,
    };
  }

  public restoreBackup(backupIdOrPath: string): boolean {
    try {
      let targetPath = backupIdOrPath;
      if (!fs.existsSync(targetPath)) {
        targetPath = path.join(this.backupDir, `${backupIdOrPath}.bak.json`);
      }

      if (!fs.existsSync(targetPath)) {
        throw new Error(`Backup file not found: ${targetPath}`);
      }

      const content = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
      if (!content.schemaVersion || !content.settings) {
        throw new Error('Invalid or corrupted backup format');
      }

      // 1. Create pre-restore safety snapshot
      this.createBackup();

      // 2. Restore settings
      this.settings.updateSettings(content.settings);

      this.logger.info(`[BackupService] Successfully restored backup: ${targetPath}`);
      return true;
    } catch (err: any) {
      this.logger.error(`[BackupService] Failed to restore backup: ${err.message}`);
      return false;
    }
  }

  private ensureBackupDir(): void {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    } catch {
      // Directory creation error
    }
  }
}

export const backupService = new BackupService();
