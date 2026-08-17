import { describe, it, expect } from 'vitest';
import { AnalystContextService } from '../src/analyst/analyst-context.service.js';
import { LocalAiAnalystService } from '../src/analyst/local-ai-analyst.service.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('Local AI Analyst Unit Tests (Phase 12)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-test-analyst-'));
  const contextService = new AnalystContextService();
  const analystService = new LocalAiAnalystService(contextService, undefined, undefined, tempDir);

  describe('AnalystContextService', () => {
    it('should generate sanitized context summary and prompt', async () => {
      const { summary, systemPromptContext } = await contextService.getContextSummary();

      expect(summary).toBeDefined();
      expect(summary.activeSocketsCount).toBeGreaterThanOrEqual(0);
      expect(systemPromptContext).toContain('SYSTEM NETWORK SNAPSHOT');
      expect(systemPromptContext).toContain('TOP ACTIVE PROCESSES BY BANDWIDTH');
    }, 15000);
  });


  describe('LocalAiAnalystService & Semantic Fallback', () => {
    it('should answer bandwidth questions with semantic metrics', async () => {
      const res = await analystService.answerQuery('What is using the most bandwidth right now?');
      expect(res.reply).toBeDefined();
      expect(res.reply.sender).toBe('assistant');
      expect(res.reply.text).toContain('bandwidth');
      expect(res.reply.suggestedActions).toBeDefined();
      expect(res.reply.suggestedActions!.length).toBeGreaterThan(0);
    }, 15000);

    it('should answer AI agent questions with detected agents list', async () => {
      const res = await analystService.answerQuery('Which AI agents are currently active?');
      expect(res.reply).toBeDefined();
      expect(res.reply.text).toMatch(/AI agents|sockets/i);
    }, 15000);

    it('should answer traffic increase and baseline questions', async () => {
      const res = await analystService.answerQuery('Why did traffic suddenly increase?');
      expect(res.reply).toBeDefined();
      expect(res.reply.text).toContain('throughput');
    }, 15000);


    it('should save and load provider configuration', () => {
      analystService.saveConfig({
        provider: 'fallback',
        ollamaModel: 'qwen2.5:latest',
      });

      const config = analystService.getConfig();
      expect(config.provider).toBe('fallback');
      expect(config.ollamaModel).toBe('qwen2.5:latest');
    });

    it('should return disabled message when provider is set to disabled', async () => {
      analystService.saveConfig({ provider: 'disabled' });
      const res = await analystService.answerQuery('Hello network analyst');
      expect(res.providerUsed).toBe('disabled');
      expect(res.reply.text).toContain('disabled');
    });
  });
});
