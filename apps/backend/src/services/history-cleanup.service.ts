import {
  DEFAULT_HISTORY_RETENTION_DAYS,
  DEFAULT_MAX_HISTORY_SIZE_MB,
} from '@network-monitor/shared';
import { HistoryService, historyService } from './history.service.js';
import { DatabaseService, databaseService } from './database.service.js';

export class HistoryCleanupService {
  private timer: NodeJS.Timeout | null = null;
  private readonly history: HistoryService;
  private readonly dbService: DatabaseService;
  private readonly retentionDays: number;
  private readonly maxSizeBytes: number;

  constructor(
    history: HistoryService = historyService,
    dbService: DatabaseService = databaseService,
    retentionDays = DEFAULT_HISTORY_RETENTION_DAYS,
    maxSizeMb = DEFAULT_MAX_HISTORY_SIZE_MB
  ) {
    this.history = history;
    this.dbService = dbService;
    this.retentionDays = retentionDays;
    this.maxSizeBytes = maxSizeMb * 1024 * 1024;
  }

  public start(intervalMs = 3600000): void {
    // Run cleanup once an hour
    if (this.timer) return;

    this.timer = setInterval(() => {
      this.performCleanup();
    }, intervalMs);

    // Initial check
    setTimeout(() => this.performCleanup(), 10000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Cleans expired records based on retention days and database size limits.
   */
  public performCleanup(): { deletedCount: number } {
    if (!this.dbService.isAvailable()) return { deletedCount: 0 };

    try {
      // 1. Time-based retention cleanup
      const cutoffMs = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
      const res = this.history.clearHistory(cutoffMs);

      // 2. Storage size limit check
      const currentSize = this.dbService.getDatabaseSizeBytes();
      if (currentSize > this.maxSizeBytes) {
        // If DB exceeds limit, delete oldest 25% of history
        const emergencyCutoff = Date.now() - Math.floor(this.retentionDays * 0.5) * 24 * 60 * 60 * 1000;
        const emRes = this.history.clearHistory(emergencyCutoff);
        return { deletedCount: res.deletedCount + emRes.deletedCount };
      }

      return res;
    } catch (err) {
      console.warn('[HistoryCleanupService] Cleanup cycle error:', err);
      return { deletedCount: 0 };
    }
  }
}

export const historyCleanupService = new HistoryCleanupService();
