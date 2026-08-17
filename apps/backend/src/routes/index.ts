import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { firewallRouter, handleBlockIp, handleUnblockIp, handleGetBlockedIps } from './firewall.routes.js';
import { historyRouter } from './history.routes.js';
import { exportRouter } from './export.routes.js';
import { intelligenceRouter } from './intelligence.routes.js';
import { systemRouter } from './system.routes.js';
import { aiRouter, investigationRouter, behaviorRouter } from './ai-intelligence.routes.js';
import { analystRouter } from './analyst.routes.js';
import { automationRouter } from './automation.routes.js';
import { securityRouter } from './security.routes.js';
import { localServersRouter } from './local-servers.routes.js';
import { diagnosticsService } from '../services/diagnostics.service.js';
import { macosService } from '../services/macos.service.js';


export const apiRouter = Router();

apiRouter.use('/security', securityRouter);
apiRouter.use('/health', healthRouter);

apiRouter.use('/firewall', firewallRouter);
apiRouter.post('/block-ip', handleBlockIp);
apiRouter.post('/unblock-ip', handleUnblockIp);
apiRouter.get('/blocked-ips', handleGetBlockedIps);
apiRouter.use('/history', historyRouter);
apiRouter.use('/export', exportRouter);
apiRouter.use('/intelligence', intelligenceRouter);
apiRouter.use('/intelligence', behaviorRouter);
apiRouter.use('/ai-agents', aiRouter);
apiRouter.use('/investigations', investigationRouter);
apiRouter.use('/analyst', analystRouter);
apiRouter.use('/automation', automationRouter);
apiRouter.use('/system', systemRouter);
apiRouter.use('/', localServersRouter);

/**
 * GET /api/ready
 */
apiRouter.get('/ready', (_req, res) => {
  res.status(200).json({
    ready: true,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/diagnostics
 */
apiRouter.get('/diagnostics', (_req, res) => {
  const report = diagnosticsService.getDiagnosticReport();
  res.status(200).json(report);
});

/**
 * GET /api/diagnostics/export
 */
apiRouter.get('/diagnostics/export', (_req, res) => {
  const report = diagnosticsService.getDiagnosticReport();
  const filename = `network-monitor-diagnostics-${new Date().toISOString().substring(0, 10)}.json`;

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(JSON.stringify(report, null, 2));
});

/**
 * GET /api/connections
 * Returns a fresh snapshot of active network connections via platform network provider.
 */
apiRouter.get('/connections', async (_req, res, next) => {
  try {
    const connections = await macosService.getNetworkConnections();
    res.status(200).json({
      timestamp: new Date().toISOString(),
      total: connections.length,
      connections,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/traffic
 * Returns a fresh snapshot of process-level network traffic rates from platform traffic provider.
 */
apiRouter.get('/traffic', async (_req, res, next) => {
  try {
    const trafficSummary = await macosService.sampleTraffic();
    res.status(200).json(trafficSummary);
  } catch (error) {
    next(error);
  }
});
