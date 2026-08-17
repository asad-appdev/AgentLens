import { Router, Request, Response } from 'express';
import { exportService } from '../services/export.service.js';

export const exportRouter = Router();

function parseTimeRange(req: Request): { from: number; to: number } {
  const now = Date.now();
  const range = (req.query.range as string) || '24h';

  if (req.query.from && req.query.to) {
    const from = parseInt(req.query.from as string, 10);
    const to = parseInt(req.query.to as string, 10);
    if (!isNaN(from) && !isNaN(to)) {
      return { from, to };
    }
  }

  switch (range) {
    case '1h':
      return { from: now - 60 * 60 * 1000, to: now };
    case '6h':
      return { from: now - 6 * 60 * 60 * 1000, to: now };
    case '24h':
      return { from: now - 24 * 60 * 60 * 1000, to: now };
    case '7d':
      return { from: now - 7 * 24 * 60 * 60 * 1000, to: now };
    default:
      return { from: now - 24 * 60 * 60 * 1000, to: now };
  }
}

/**
 * GET /api/export/snapshot
 * Exports current live system snapshot (JSON).
 */
exportRouter.get('/snapshot', async (_req: Request, res: Response) => {
  try {
    const snapshot = await exportService.generateSnapshotExport();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="network-monitor-snapshot-${Date.now()}.json"`);
    res.status(200).send(JSON.stringify(snapshot, null, 2));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Snapshot export error';
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/export/history
 * Exports historical data in JSON or RFC 4180 CSV.
 */
exportRouter.get('/history', (req: Request, res: Response) => {
  const { from, to } = parseTimeRange(req);
  const format = ((req.query.format as string) || 'json').toLowerCase();
  const type = ((req.query.type as string) || 'connections').toLowerCase();

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="network-monitor-${type}-${Date.now()}.csv"`);

    if (type === 'traffic') {
      const csv = exportService.generateTrafficCsv(from, to);
      res.status(200).send(csv);
    } else {
      const csv = exportService.generateConnectionsCsv(from, to);
      res.status(200).send(csv);
    }
    return;
  }

  // Default JSON export
  const jsonPayload = exportService.generateHistoryJson(from, to);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="network-monitor-history-${Date.now()}.json"`);
  res.status(200).send(JSON.stringify(jsonPayload, null, 2));
});
