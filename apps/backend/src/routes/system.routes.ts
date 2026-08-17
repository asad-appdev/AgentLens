import { Router, Request, Response } from 'express';
import { diagnosticsService } from '../services/diagnostics.service.js';
import { backupService } from '../services/backup.service.js';
import { platformService } from '../platform/index.js';
import { APP_VERSION } from '@network-monitor/shared';

export const systemRouter = Router();

/**
 * GET /api/system/platform
 * Returns normalized platform detection metadata.
 */
systemRouter.get('/platform', (_req: Request, res: Response) => {
  const platformInfo = platformService.getPlatformInfo();
  res.status(200).json(platformInfo);
});

/**
 * GET /api/system/status
 */
systemRouter.get('/status', (_req: Request, res: Response) => {
  const monitors = diagnosticsService.getMonitorsStatus();
  const isPaused = diagnosticsService.getIsPaused();

  res.status(200).json({
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    appVersion: APP_VERSION,
    isPaused,
    monitors,
  });
});


/**
 * POST /api/system/pause
 */
systemRouter.post('/pause', (_req: Request, res: Response) => {
  diagnosticsService.setPaused(true);
  res.status(200).json({ success: true, isPaused: true });
});

/**
 * POST /api/system/resume
 */
systemRouter.post('/resume', (_req: Request, res: Response) => {
  diagnosticsService.setPaused(false);
  res.status(200).json({ success: true, isPaused: false });
});

/**
 * GET /api/system/backup
 */
systemRouter.get('/backup', (_req: Request, res: Response) => {
  const backups = backupService.listBackups();
  res.status(200).json({ backups });
});

/**
 * POST /api/system/backup
 */
systemRouter.post('/backup', (_req: Request, res: Response) => {
  const backup = backupService.createBackup();
  res.status(200).json({ success: true, backup });
});

/**
 * POST /api/system/restore
 */
systemRouter.post('/restore', (req: Request, res: Response) => {
  const { backupId } = req.body;
  if (!backupId) {
    res.status(400).json({ error: 'backupId is required' });
    return;
  }

  const success = backupService.restoreBackup(backupId);
  if (!success) {
    res.status(500).json({ error: 'Failed to restore backup snapshot' });
    return;
  }

  res.status(200).json({ success: true, message: 'Backup restored successfully' });
});
