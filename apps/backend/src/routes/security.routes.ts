import { Router, Request, Response } from 'express';
import { securityAlertsService } from '../security/alerts/security-alerts.service.js';
import { securityIncidentService } from '../security/incident/security-incident.service.js';
import { securityTimelineService } from '../security/timeline/security-timeline.service.js';
import { sensitiveFileDetectorService } from '../security/files/sensitive-file-detector.service.js';
import { agentProcessTreeService } from '../security/process/agent-process-tree.service.js';
import { persistenceDetectorService } from '../security/persistence/persistence-detector.service.js';
import { packageMonitorService } from '../security/packages/package-monitor.service.js';
import { agentPolicyService } from '../security/policy/agent-policy.service.js';
import { securityInvestigatorService } from '../security/investigator/security-investigator.service.js';
import { securityCorrelationEngine } from '../security/correlation/security-correlation-engine.service.js';

export const securityRouter = Router();

/**
 * GET /api/security/alerts
 */
securityRouter.get('/alerts', (req: Request, res: Response) => {
  const severity = req.query.severity as any;
  const alerts = securityAlertsService.getActiveAlerts(severity);
  res.json({ count: alerts.length, alerts });
});

/**
 * POST /api/security/alerts/:id/dismiss
 */
securityRouter.post('/alerts/:id/dismiss', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const success = securityAlertsService.dismissAlert(id);
  res.json({ success, id });
});

/**
 * POST /api/security/alerts/:id/trust
 */
securityRouter.post('/alerts/:id/trust', (req: Request, res: Response) => {
  const { type, value, reason } = req.body;
  const id = req.params.id as string;
  if (!type || !value) {
    res.status(400).json({ error: 'Missing type or value' });
    return;
  }
  const record = agentPolicyService.addTrustedEntity(type, value, reason);
  securityAlertsService.dismissAlert(id);
  res.json({ success: true, trusted: record });
});


/**
 * GET /api/security/incidents
 */
securityRouter.get('/incidents', (_req: Request, res: Response) => {
  const incidents = securityIncidentService.getAllIncidents();
  res.json({ count: incidents.length, incidents });
});

/**
 * GET /api/security/timeline
 */
securityRouter.get('/timeline', (req: Request, res: Response) => {
  const filter = {
    agentId: req.query.agentId as string,
    pid: req.query.pid ? parseInt(req.query.pid as string, 10) : undefined,
    severity: req.query.severity as any,
    eventType: req.query.eventType as any,
    timeRange: req.query.timeRange as any,
    searchQuery: req.query.q as string,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
    offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
  };
  const result = securityTimelineService.queryTimeline(filter);
  res.json(result);
});

/**
 * GET /api/security/sensitive-files
 */
securityRouter.get('/sensitive-files', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const category = req.query.category as any;
  const files = sensitiveFileDetectorService.getRecentAccesses(limit, category);
  res.json({ count: files.length, files });
});

/**
 * POST /api/security/sensitive-files/record and /api/security/sensitive-files
 * Records access with metadata only (and triggers correlation)
 */
const handleRecordSensitiveFile = (req: Request, res: Response) => {
  const { filePath, accessedBy, pid, processName, remoteHost, remotePort, bytesOut } = req.body;
  if (!filePath || !pid || !processName) {
    res.status(400).json({ error: 'Missing required parameters (filePath, pid, processName)' });
    return;
  }

  const access = sensitiveFileDetectorService.recordAccess(filePath, accessedBy || processName, pid, processName);
  let alert = null;
  if (access) {
    alert = securityCorrelationEngine.handleSensitiveFileAccess(access);

    if (remoteHost) {
      alert = securityCorrelationEngine.handleOutboundDestination(
        pid,
        accessedBy || processName,
        processName,
        remoteHost,
        remotePort || 443,
        bytesOut || 1024 * 1024,
        true
      );
    }
  }

  res.json({ recorded: Boolean(access), access, generatedAlert: alert });
};

securityRouter.post('/sensitive-files/record', handleRecordSensitiveFile);
securityRouter.post('/sensitive-files', handleRecordSensitiveFile);


/**
 * GET /api/security/process-tree/:agentId/:pid
 */
securityRouter.get('/process-tree/:agentId/:pid', async (req: Request, res: Response) => {
  const pid = parseInt(req.params.pid as string, 10);
  const agentId = req.params.agentId as string;
  const result = await agentProcessTreeService.getProcessTreeForAgent(agentId, pid);
  res.json(result);
});

/**
 * GET /api/security/persistence
 */
securityRouter.get('/persistence', async (_req: Request, res: Response) => {
  const items = await persistenceDetectorService.scanPersistence();
  res.json({ count: items.length, items });
});

/**
 * GET /api/security/packages
 */
securityRouter.get('/packages', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const events = packageMonitorService.getRecentEvents(limit);
  res.json({ count: events.length, events });
});

/**
 * GET /api/security/policies
 */
securityRouter.get('/policies', (_req: Request, res: Response) => {
  const policies = agentPolicyService.getPolicies();
  res.json({ count: policies.length, policies });
});

/**
 * GET /api/security/trusted
 */
securityRouter.get('/trusted', (_req: Request, res: Response) => {
  const trusted = agentPolicyService.getTrustedEntities();
  res.json({ count: trusted.length, trusted });
});

/**
 * POST /api/security/trusted
 */
securityRouter.post('/trusted', (req: Request, res: Response) => {
  const { type, value, reason } = req.body;
  if (!type || !value) {
    res.status(400).json({ error: 'Missing type or value' });
    return;
  }
  const record = agentPolicyService.addTrustedEntity(type, value, reason);
  res.json({ success: true, record });
});

/**
 * DELETE /api/security/trusted/:id
 */
securityRouter.delete('/trusted/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const success = agentPolicyService.removeTrustedEntity(id);
  res.json({ success });
});


/**
 * POST /api/security/investigate
 */
securityRouter.post('/investigate', async (req: Request, res: Response) => {
  const { targetId, question } = req.body;
  if (!targetId) {
    res.status(400).json({ error: 'Missing targetId' });
    return;
  }
  const result = await securityInvestigatorService.investigate(targetId, question);
  res.json(result);
});

/**
 * POST /api/security/clear-history
 */
securityRouter.post('/clear-history', (_req: Request, res: Response) => {
  securityTimelineService.clearAllSecurityData();
  securityAlertsService.clearAll();
  sensitiveFileDetectorService.clearHistory();
  res.json({ success: true, message: 'All security history and alerts cleared' });
});
