import { Router, Request, Response } from 'express';
import { historyService } from '../services/history.service.js';

export const historyRouter = Router();

function parseTimeRange(req: Request): { from: number; to: number } {
  const now = Date.now();
  const range = (req.query.range as string) || '1h';

  if (req.query.from && req.query.to) {
    const from = parseInt(req.query.from as string, 10);
    const to = parseInt(req.query.to as string, 10);
    if (!isNaN(from) && !isNaN(to)) {
      return { from, to };
    }
  }

  switch (range) {
    case '5m':
      return { from: now - 5 * 60 * 1000, to: now };
    case '30m':
      return { from: now - 30 * 60 * 1000, to: now };
    case '1h':
      return { from: now - 60 * 60 * 1000, to: now };
    case '6h':
      return { from: now - 6 * 60 * 60 * 1000, to: now };
    case '24h':
      return { from: now - 24 * 60 * 60 * 1000, to: now };
    case '7d':
      return { from: now - 7 * 24 * 60 * 60 * 1000, to: now };
    default:
      return { from: now - 60 * 60 * 1000, to: now };
  }
}

/**
 * GET /api/history/summary
 */
historyRouter.get('/summary', (req: Request, res: Response) => {
  const { from, to } = parseTimeRange(req);
  const summary = historyService.getHistorySummary(from, to);
  res.status(200).json(summary);
});

/**
 * GET /api/history/timeline
 */
historyRouter.get('/timeline', (req: Request, res: Response) => {
  const { from, to } = parseTimeRange(req);
  const buckets = parseInt(req.query.buckets as string, 10) || 30;
  const timeline = historyService.getTrafficTimeline(from, to, buckets);
  res.status(200).json({
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    bucketsCount: timeline.length,
    timeline,
  });
});

/**
 * GET /api/history/connections
 */
historyRouter.get('/connections', (req: Request, res: Response) => {
  const { from, to } = parseTimeRange(req);
  const pid = req.query.pid ? parseInt(req.query.pid as string, 10) : undefined;
  const processName = req.query.process as string | undefined;
  const remoteAddress = req.query.ip as string | undefined;
  const isAiAgent = req.query.aiAgentOnly === 'true' ? true : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

  const result = historyService.queryConnections({
    from,
    to,
    pid,
    processName,
    remoteAddress,
    isAiAgent,
    limit,
    offset,
  });

  res.status(200).json({
    timestamp: new Date().toISOString(),
    ...result,
    limit,
    offset,
  });
});

/**
 * GET /api/history/processes
 */
historyRouter.get('/processes', (req: Request, res: Response) => {
  const { from, to } = parseTimeRange(req);
  const pid = req.query.pid ? parseInt(req.query.pid as string, 10) : undefined;
  const processName = req.query.process as string | undefined;
  const isAiAgent = req.query.aiAgentOnly === 'true' ? true : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

  const result = historyService.queryProcesses({
    from,
    to,
    pid,
    processName,
    isAiAgent,
    limit,
    offset,
  });

  res.status(200).json({
    timestamp: new Date().toISOString(),
    ...result,
    limit,
    offset,
  });
});

/**
 * GET /api/history/process-detail/:pid
 */
historyRouter.get('/process-detail/:pid', (req: Request, res: Response) => {
  const pid = parseInt(String(req.params.pid), 10);
  if (isNaN(pid)) {
    res.status(400).json({ error: 'Valid PID is required' });
    return;
  }

  const detail = historyService.getProcessDetail(pid);
  if (!detail) {
    res.status(404).json({ error: `No historical records found for PID ${pid}` });
    return;
  }

  res.status(200).json(detail);
});

/**
 * GET /api/history/top-ips
 */
historyRouter.get('/top-ips', (req: Request, res: Response) => {
  const { from, to } = parseTimeRange(req);
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const ips = historyService.getTopRemoteIps(from, to, limit);
  res.status(200).json({
    timestamp: new Date().toISOString(),
    total: ips.length,
    topIps: ips,
  });
});

/**
 * GET /api/history/status
 */
historyRouter.get('/status', (_req: Request, res: Response) => {
  const status = historyService.getStatus();
  res.status(200).json(status);
});

/**
 * POST /api/history/toggle-recording
 */
historyRouter.post('/toggle-recording', (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'Boolean "enabled" field is required' });
    return;
  }

  historyService.setRecordingEnabled(enabled);
  res.status(200).json({ isRecording: historyService.isRecordingEnabled() });
});

/**
 * POST /api/history/clear
 */
historyRouter.post('/clear', (req: Request, res: Response) => {
  const { olderThanHours } = req.body;
  let cutoffMs: number | undefined;

  if (typeof olderThanHours === 'number' && olderThanHours > 0) {
    cutoffMs = Date.now() - olderThanHours * 60 * 60 * 1000;
  }

  const result = historyService.clearHistory(cutoffMs);
  res.status(200).json(result);
});
