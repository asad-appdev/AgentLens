import { Router, Request, Response } from 'express';
import { APP_VERSION } from '@network-monitor/shared';
import { platformService } from '../platform/index.js';
import { diagnosticsService } from '../services/diagnostics.service.js';

export const healthRouter = Router();

/**
 * GET /api/health
 * Returns service health status, monitors status, and basic system info.
 */
healthRouter.get('/', (_req: Request, res: Response) => {
  const metadata = platformService.getSystemProvider().getSystemMetadata();
  const monitors = diagnosticsService.getMonitorsStatus();
  const isPaused = diagnosticsService.getIsPaused();

  res.status(200).json({
    status: 'ok',
    version: APP_VERSION,
    uptime: Math.floor(process.uptime()),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    platform: metadata.platform,
    arch: metadata.arch,
    isPaused,
    monitors,
  });
});

