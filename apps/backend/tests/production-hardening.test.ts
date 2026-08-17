import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { LoggerService } from '../src/services/logger.service.js';
import { ProcessSupervisor } from '../src/services/process-supervisor.service.js';
import { BackupService } from '../src/services/backup.service.js';
import { DatabaseService } from '../src/services/database.service.js';
import { SettingsService } from '../src/services/settings.service.js';
import { DiagnosticsService } from '../src/services/diagnostics.service.js';

describe('Production Hardening & System Services (Phase 10)', () => {
  let tempDir: string;
  let logger: LoggerService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-test-prod-'));
    logger = new LoggerService(path.join(tempDir, 'logs'));
  });

  describe('LoggerService & Sanitization', () => {
    it('should sanitize sensitive tokens and passwords from logs', () => {
      logger.info('User login attempted with password=superSecretPassword123 and token=xyz987');
      const errors = logger.getRecentErrors();
      expect(errors).toBeDefined();

      const logFile = path.join(tempDir, 'logs', 'app.log');
      expect(fs.existsSync(logFile)).toBe(true);
      const content = fs.readFileSync(logFile, 'utf-8');
      expect(content).toContain('password=***');
      expect(content).toContain('token=***');
      expect(content).not.toContain('superSecretPassword123');
    });

    it('should record recent errors in memory buffer', () => {
      logger.error('Database connection failed');
      const errors = logger.getRecentErrors();
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0]!.message).toContain('Database connection failed');
    });
  });

  describe('ProcessSupervisor & Exponential Backoff', () => {
    it('should register and track managed processes', () => {
      const supervisor = new ProcessSupervisor(logger);
      supervisor.register('nettop', '/usr/bin/nettop', ['-P', '-L', '1', '-J', 'bytes_in,bytes_out']);

      expect(supervisor.getState('nettop')).toBe('stopped');
      expect(supervisor.getAllStates()).toHaveProperty('nettop');
    });

    it('should handle unexpected child exit with backoff state', () => {
      const supervisor = new ProcessSupervisor(logger);
      supervisor.register('test-proc', 'echo', ['hi'], 3);

      supervisor.handleProcessExit('test-proc', 1, 'SIGTERM');
      expect(supervisor.getState('test-proc')).toBe('degraded');
    });
  });

  describe('BackupService & Metadata Snapshots', () => {
    it('should create and list timestamped backup snapshots', () => {
      const dbService = new DatabaseService({ inMemory: true });
      const settings = new SettingsService(tempDir);
      const backupService = new BackupService(path.join(tempDir, 'backups'), dbService, settings, logger);

      const backup = backupService.createBackup();
      expect(backup).toHaveProperty('id');
      expect(backup.appVersion).toBe('1.0.0');

      const list = backupService.listBackups();
      expect(list.length).toBe(1);
      expect(list[0]!.id).toBe(backup.id);
    });

    it('should safely restore existing backup', () => {
      const dbService = new DatabaseService({ inMemory: true });
      const settings = new SettingsService(tempDir);
      const backupService = new BackupService(path.join(tempDir, 'backups'), dbService, settings, logger);

      settings.setProcessLabel('test', 'Original Label');
      const backup = backupService.createBackup();

      settings.setProcessLabel('test', 'Modified Label');
      expect(settings.getProcessLabel('test')).toBe('Modified Label');

      const restored = backupService.restoreBackup(backup.id);
      expect(restored).toBe(true);
      expect(settings.getProcessLabel('test')).toBe('Original Label');
    });
  });

  describe('DiagnosticsService', () => {
    it('should compile comprehensive sanitized diagnostic report', () => {
      const dbService = new DatabaseService({ inMemory: true });
      const diag = new DiagnosticsService(dbService);

      const report = diag.getDiagnosticReport();
      expect(report.appVersion).toBe('1.0.0');
      expect(report.platform).toBe(process.platform);
      expect(report.monitors.backend).toBe('running');
      expect(report.memoryUsageMb.rss).toBeGreaterThan(0);
    });

    it('should reflect paused state across monitors', () => {
      const dbService = new DatabaseService({ inMemory: true });
      const diag = new DiagnosticsService(dbService);

      expect(diag.getIsPaused()).toBe(false);
      diag.setPaused(true);
      expect(diag.getIsPaused()).toBe(true);
      expect(diag.getMonitorsStatus().connections).toBe('paused');
    });
  });
});
