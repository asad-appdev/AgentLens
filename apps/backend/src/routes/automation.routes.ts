import { Router, Request, Response } from 'express';
import { actionPreparationService } from '../automation/action-preparation.service.js';
import { watchRulesService } from '../automation/watch-rules.service.js';

export const automationRouter = Router();

/**
 * GET /api/automation/actions
 */
automationRouter.get('/actions', (_req: Request, res: Response) => {
  const actions = actionPreparationService.getPendingActions();
  res.status(200).json({ actions });
});

/**
 * POST /api/automation/actions/:id/confirm
 */
automationRouter.post('/actions/:id/confirm', (req: Request, res: Response) => {
  const result = actionPreparationService.confirmAction(String(req.params.id));
  if (!result.success) {
    res.status(404).json(result);
    return;
  }
  res.status(200).json(result);
});

/**
 * DELETE /api/automation/actions/:id
 */
automationRouter.delete('/actions/:id', (req: Request, res: Response) => {
  const success = actionPreparationService.dismissAction(String(req.params.id));
  res.status(200).json({ success });
});

/**
 * GET /api/automation/watch-rules
 */
automationRouter.get('/watch-rules', (_req: Request, res: Response) => {
  const rules = watchRulesService.listRules();
  res.status(200).json({ rules });
});

/**
 * POST /api/automation/watch-rules
 */
automationRouter.post('/watch-rules', (req: Request, res: Response) => {
  const { name, targetType, targetName, triggerType, threshold, action } = req.body;
  if (!name || !targetType || !targetName || !triggerType || !action) {
    res.status(400).json({ error: 'name, targetType, targetName, triggerType, and action are required' });
    return;
  }
  const rule = watchRulesService.createRule({ name, targetType, targetName, triggerType, threshold, action });
  res.status(201).json(rule);
});

/**
 * DELETE /api/automation/watch-rules/:id
 */
automationRouter.delete('/watch-rules/:id', (req: Request, res: Response) => {
  const success = watchRulesService.deleteRule(String(req.params.id));
  res.status(200).json({ success });
});

/**
 * POST /api/automation/nl-filter
 */
automationRouter.post('/nl-filter', (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'query is required' });
    return;
  }
  const filter = actionPreparationService.parseNaturalLanguageFilter(query);
  res.status(200).json(filter);
});
