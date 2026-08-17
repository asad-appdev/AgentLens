import { Router, Request, Response } from 'express';
import { aiAgentNetworkService } from '../intelligence/ai/ai-network.service.js';
import { aiAgentSessionService } from '../intelligence/ai/ai-session.service.js';
import { behaviorAnalyzerService } from '../intelligence/behavior/behavior-analyzer.service.js';
import { investigationService } from '../intelligence/investigation/investigation.service.js';

export const aiRouter = Router();
export const investigationRouter = Router();
export const behaviorRouter = Router();

/**
 * GET /api/ai-agents
 */
aiRouter.get('/', async (_req: Request, res: Response) => {
  const profiles = await aiAgentNetworkService.getAiAgentProfiles();
  res.status(200).json({ timestamp: new Date().toISOString(), agents: profiles });
});

/**
 * GET /api/ai-agents/:id
 */
aiRouter.get('/:id', async (req: Request, res: Response) => {
  const agentId = String(req.params.id);
  const profiles = await aiAgentNetworkService.getAiAgentProfiles();
  const profile = profiles.find((p) => p.agentId === agentId);
  if (!profile) {
    res.status(404).json({ error: `AI Agent "${agentId}" not found` });
    return;
  }
  res.status(200).json(profile);
});

/**
 * GET /api/ai-agents/:id/sessions
 */
aiRouter.get('/:id/sessions', (req: Request, res: Response) => {
  const agentId = String(req.params.id);
  const sessions = aiAgentSessionService.getSessionsForAgent(agentId);
  res.status(200).json({ agentId, sessions });
});

/**
 * GET /api/ai-agents/:id/graph
 */
aiRouter.get('/:id/graph', async (req: Request, res: Response) => {
  const agentId = String(req.params.id);
  const graph = await aiAgentNetworkService.getNetworkRelationshipGraph(agentId);
  res.status(200).json(graph);
});

/**
 * GET /api/intelligence/baselines
 */
behaviorRouter.get('/baselines', async (req: Request, res: Response) => {
  const entityId = String(req.query.entityId || 'system');
  const baseline = await behaviorAnalyzerService.getBaseline(entityId);
  res.status(200).json(baseline);
});

/**
 * GET /api/intelligence/indicators
 */
behaviorRouter.get('/indicators', async (_req: Request, res: Response) => {
  const indicators = await behaviorAnalyzerService.analyzeLiveBehavior();
  res.status(200).json({ timestamp: new Date().toISOString(), indicators });
});

/**
 * GET /api/intelligence/suggestions
 */
behaviorRouter.get('/suggestions', (_req: Request, res: Response) => {
  const suggestions = behaviorAnalyzerService.getSmartSuggestions();
  res.status(200).json({ timestamp: new Date().toISOString(), suggestions });
});

/**
 * POST /api/intelligence/suggestions/:id/action
 */
behaviorRouter.post('/suggestions/:id/action', (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body;
  if (!status) {
    res.status(400).json({ error: 'status is required' });
    return;
  }
  const success = behaviorAnalyzerService.updateSuggestionStatus(id, status);
  res.status(200).json({ success });
});

/**
 * GET /api/investigations
 */
investigationRouter.get('/', (_req: Request, res: Response) => {
  const list = investigationService.listInvestigations();
  res.status(200).json({ investigations: list });
});

/**
 * POST /api/investigations
 */
investigationRouter.post('/', (req: Request, res: Response) => {
  const { title, description } = req.body;
  if (!title || !title.trim()) {
    res.status(400).json({ error: 'title is required' });
    return;
  }
  const ws = investigationService.createInvestigation(title, description);
  res.status(201).json(ws);
});

/**
 * GET /api/investigations/:id
 */
investigationRouter.get('/:id', (req: Request, res: Response) => {
  const ws = investigationService.getInvestigation(String(req.params.id));
  if (!ws) {
    res.status(404).json({ error: 'Investigation not found' });
    return;
  }
  res.status(200).json(ws);
});

/**
 * PATCH /api/investigations/:id
 */
investigationRouter.patch('/:id', (req: Request, res: Response) => {
  const updated = investigationService.updateInvestigation(String(req.params.id), req.body);
  if (!updated) {
    res.status(404).json({ error: 'Investigation not found' });
    return;
  }
  res.status(200).json(updated);
});

/**
 * DELETE /api/investigations/:id
 */
investigationRouter.delete('/:id', (req: Request, res: Response) => {
  const success = investigationService.deleteInvestigation(String(req.params.id));
  res.status(200).json({ success });
});

/**
 * POST /api/investigations/:id/items
 */
investigationRouter.post('/:id/items', (req: Request, res: Response) => {
  const { type, targetId, title, metadata } = req.body;
  if (!type || !targetId || !title) {
    res.status(400).json({ error: 'type, targetId, and title are required' });
    return;
  }
  const item = investigationService.addItem(String(req.params.id), type, targetId, title, metadata);
  if (!item) {
    res.status(404).json({ error: 'Investigation not found' });
    return;
  }
  res.status(201).json(item);
});

/**
 * DELETE /api/investigations/:id/items/:itemId
 */
investigationRouter.delete('/:id/items/:itemId', (req: Request, res: Response) => {
  const success = investigationService.removeItem(String(req.params.id), String(req.params.itemId));
  res.status(200).json({ success });
});

/**
 * POST /api/investigations/:id/notes
 */
investigationRouter.post('/:id/notes', (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    res.status(400).json({ error: 'text is required' });
    return;
  }
  const note = investigationService.addNote(String(req.params.id), text);
  if (!note) {
    res.status(404).json({ error: 'Investigation not found' });
    return;
  }
  res.status(201).json(note);
});

/**
 * DELETE /api/investigations/:id/notes/:noteId
 */
investigationRouter.delete('/:id/notes/:noteId', (req: Request, res: Response) => {
  const success = investigationService.removeNote(String(req.params.id), String(req.params.noteId));
  res.status(200).json({ success });
});

/**
 * GET /api/investigations/:id/export
 */
investigationRouter.get('/:id/export', (req: Request, res: Response) => {
  const format = (String(req.query.format || 'json').toLowerCase()) as 'json' | 'csv' | 'html';
  const exported = investigationService.exportInvestigation(String(req.params.id), format);
  if (!exported) {
    res.status(404).json({ error: 'Investigation not found' });
    return;
  }

  res.setHeader('Content-Type', exported.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
  res.status(200).send(exported.content);
});
