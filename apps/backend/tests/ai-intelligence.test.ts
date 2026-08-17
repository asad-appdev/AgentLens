import { describe, it, expect } from 'vitest';
import { AiAgentRegistry } from '../src/intelligence/ai/ai-agent-registry.js';
import { AiAgentDetector } from '../src/intelligence/ai/ai-agent-detector.js';
import { AiAgentSessionService } from '../src/intelligence/ai/ai-session.service.js';
import { InvestigationService } from '../src/intelligence/investigation/investigation.service.js';
import { SettingsService } from '../src/services/settings.service.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('AI Agent Intelligence Unit Tests (Phase 11)', () => {
  const registry = new AiAgentRegistry();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-test-ai-'));
  const settings = new SettingsService(tempDir);
  const detector = new AiAgentDetector(registry, settings);

  describe('AiAgentRegistry & Signatures', () => {
    it('should have all built-in AI agents registered', () => {
      const all = registry.getAll();
      expect(all.length).toBeGreaterThanOrEqual(10);
      expect(all.some((a) => a.id === 'ollama')).toBe(true);
      expect(all.some((a) => a.id === 'lm-studio')).toBe(true);
      expect(all.some((a) => a.id === 'claude-code')).toBe(true);
    });

    it('should match known process names and ports accurately', () => {
      const match1 = registry.matchProcess('ollama', 'ollama serve', [11434]);
      expect(match1).not.toBeNull();
      expect(match1?.agent.id).toBe('ollama');

      const match2 = registry.matchProcess('claude', 'claude-code session');
      expect(match2).not.toBeNull();
      expect(match2?.agent.id).toBe('claude-code');
    });
  });

  describe('AiAgentDetector & Confidence Grading', () => {
    it('should assign HIGH confidence when multiple sources match', () => {
      const res = detector.detect(4218, 'ollama', 'ollama serve', [11434]);
      expect(res).not.toBeNull();
      expect(res?.agentId).toBe('ollama');
      expect(res?.confidence).toBe('HIGH');
      expect(res?.isLocalServer).toBe(true);
    });

    it('should respect manual user AI classification with MANUAL confidence', () => {
      settings.setProcessLabel('custom-node-proc', 'My Custom AI Assistant');
      const res = detector.detect(9999, 'custom-node-proc');
      expect(res).not.toBeNull();
      expect(res?.confidence).toBe('MANUAL');
      expect(res?.detectionSources).toContain('manual');
    });
  });

  describe('AiAgentSessionService', () => {
    it('should track and update session metrics over time', () => {
      const sessionService = new AiAgentSessionService();
      const s1 = sessionService.updateSessionObservation(
        'ollama',
        'Ollama',
        4218,
        2048,
        1024,
        ['142.250.72.14'],
        [4219]
      );

      expect(s1.sessionId).toBeDefined();
      expect(s1.status).toBe('ACTIVE');
      expect(s1.uniqueRemoteIps).toContain('142.250.72.14');
      expect(s1.childPids).toContain(4219);

      sessionService.endSession('ollama:4218');
      const sessions = sessionService.getSessionsForAgent('ollama');
      expect(sessions.some((s) => s.status === 'ENDED')).toBe(true);
    });
  });

  describe('InvestigationService', () => {
    it('should manage investigation workspaces, pinned items, and exports', () => {
      const invService = new InvestigationService();
      const ws = invService.createInvestigation('Test AI Investigation', 'Checking Claude Code traffic');

      expect(ws.id).toBeDefined();
      expect(ws.title).toBe('Test AI Investigation');

      const pin = invService.addItem(ws.id, 'agent', 'claude-code', 'Claude Code CLI');
      expect(pin).not.toBeNull();

      const note = invService.addNote(ws.id, 'Observed 4 concurrent sockets to remote endpoints.');
      expect(note).not.toBeNull();

      const jsonExport = invService.exportInvestigation(ws.id, 'json');
      expect(jsonExport?.mimeType).toBe('application/json');
      expect(jsonExport?.content).toContain('Test AI Investigation');

      const htmlExport = invService.exportInvestigation(ws.id, 'html');
      expect(htmlExport?.mimeType).toBe('text/html');
      expect(htmlExport?.content).toContain('<html>');
    });
  });
});
