import { Router, Request, Response } from 'express';
import { localAiAnalystService } from '../analyst/local-ai-analyst.service.js';

export const analystRouter = Router();

/**
 * POST /api/analyst/query
 * Queries the Local AI Analyst using natural language.
 */
analystRouter.post('/query', async (req: Request, res: Response) => {
  const { query, history } = req.body;
  if (!query || typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: 'query is required' });
    return;
  }

  const response = await localAiAnalystService.answerQuery(query.trim(), history || []);
  res.status(200).json(response);
});

/**
 * GET /api/analyst/config
 * Returns the current LLM configuration.
 */
analystRouter.get('/config', (_req: Request, res: Response) => {
  const config = localAiAnalystService.getConfig();
  // Mask sensitive OpenAI API key if present
  const sanitized = {
    ...config,
    openaiApiKey: config.openaiApiKey ? `sk-...${config.openaiApiKey.slice(-4)}` : undefined,
  };
  res.status(200).json(sanitized);
});

/**
 * PUT /api/analyst/config
 * Updates the LLM configuration.
 */
analystRouter.put('/config', (req: Request, res: Response) => {
  const updated = localAiAnalystService.saveConfig(req.body);
  res.status(200).json({
    ...updated,
    openaiApiKey: updated.openaiApiKey ? `sk-...${updated.openaiApiKey.slice(-4)}` : undefined,
  });
});

/**
 * GET /api/analyst/models
 * Probes available models from the local Ollama instance.
 */
analystRouter.get('/models', async (_req: Request, res: Response) => {
  const models = await localAiAnalystService.getAvailableOllamaModels();
  res.status(200).json({ models });
});
