import { Router, Request, Response } from 'express';
import { processInspectorService } from '../services/process-inspector.service.js';
import { processRelationshipService } from '../services/process-relationship.service.js';
import { connectionInspectorService } from '../services/connection-inspector.service.js';
import { remoteIpInspectorService } from '../services/remote-ip-inspector.service.js';
import { notificationService } from '../services/notification.service.js';
import { settingsService } from '../services/settings.service.js';
import { platformService } from '../platform/index.js';

export const intelligenceRouter = Router();

/**
 * GET /api/intelligence/process/:pid
 */
intelligenceRouter.get('/process/:pid', async (req: Request, res: Response) => {
  const pid = parseInt(String(req.params.pid), 10);
  if (isNaN(pid)) {
    res.status(400).json({ error: 'Valid PID is required' });
    return;
  }

  const detail = await processInspectorService.inspectProcess(pid);
  if (!detail) {
    res.status(404).json({ error: `Process PID ${pid} not found or no longer active` });
    return;
  }

  res.status(200).json(detail);
});

/**
 * GET /api/intelligence/process-tree
 */
intelligenceRouter.get('/process-tree', async (_req: Request, res: Response) => {
  const connections = await platformService.getNetworkProvider().getConnections();
  const activePids = Array.from(new Set(connections.map((c) => c.pid)));
  const tree = await processRelationshipService.buildProcessTree(activePids);
  res.status(200).json({ timestamp: new Date().toISOString(), tree });
});


/**
 * GET /api/intelligence/connection/:id
 */
intelligenceRouter.get('/connection/:id', async (req: Request, res: Response) => {
  const connectionId = String(req.params.id);
  const detail = await connectionInspectorService.inspectConnection(connectionId);
  if (!detail) {
    res.status(404).json({ error: `Connection ID ${connectionId} not found` });
    return;
  }
  res.status(200).json(detail);
});

/**
 * GET /api/intelligence/remote-ip/:ip
 */
intelligenceRouter.get('/remote-ip/:ip', async (req: Request, res: Response) => {
  const ip = String(req.params.ip);
  const detail = await remoteIpInspectorService.inspectRemoteIp(ip);
  if (!detail) {
    res.status(404).json({ error: `Remote IP ${ip} not found` });
    return;
  }
  res.status(200).json(detail);
});

/**
 * GET /api/intelligence/events
 */
intelligenceRouter.get('/events', (_req: Request, res: Response) => {
  const events = notificationService.getEvents();
  const unreadCount = notificationService.getUnreadCount();
  res.status(200).json({ timestamp: new Date().toISOString(), unreadCount, events });
});

/**
 * POST /api/intelligence/events/read
 */
intelligenceRouter.post('/events/read', (_req: Request, res: Response) => {
  notificationService.markAllRead();
  res.status(200).json({ success: true });
});

/**
 * POST /api/intelligence/events/clear
 */
intelligenceRouter.post('/events/clear', (_req: Request, res: Response) => {
  notificationService.clearEvents();
  res.status(200).json({ success: true });
});

/**
 * GET /api/intelligence/settings
 */
intelligenceRouter.get('/settings', (_req: Request, res: Response) => {
  const settings = settingsService.getSettings();
  res.status(200).json(settings);
});

/**
 * PUT /api/intelligence/settings
 */
intelligenceRouter.put('/settings', (req: Request, res: Response) => {
  const updated = settingsService.updateSettings(req.body);
  res.status(200).json(updated);
});

/**
 * POST /api/intelligence/favorite
 */
intelligenceRouter.post('/favorite', (req: Request, res: Response) => {
  const { pid, processName } = req.body;
  if (!pid && !processName) {
    res.status(400).json({ error: 'pid or processName required' });
    return;
  }
  const isFav = settingsService.toggleFavorite(Number(pid) || 0, processName || '');
  res.status(200).json({ isFavorite: isFav });
});

/**
 * POST /api/intelligence/label
 */
intelligenceRouter.post('/label', (req: Request, res: Response) => {
  const { key, label } = req.body;
  if (!key) {
    res.status(400).json({ error: 'key required' });
    return;
  }
  settingsService.setProcessLabel(key, label);
  res.status(200).json({ success: true, label });
});

/**
 * POST /api/intelligence/tags
 */
intelligenceRouter.post('/tags', (req: Request, res: Response) => {
  const { key, tags } = req.body;
  if (!key || !Array.isArray(tags)) {
    res.status(400).json({ error: 'key and tags array required' });
    return;
  }
  settingsService.setTags(key, tags);
  res.status(200).json({ success: true, tags });
});
