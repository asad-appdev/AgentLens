import { describe, it, expect } from 'vitest';
import { ActionPreparationService } from '../src/automation/action-preparation.service.js';
import { WatchRulesService } from '../src/automation/watch-rules.service.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

describe('Automation & Prepared Actions Unit Tests (Phase 13)', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-test-auto-'));
  const actionService = new ActionPreparationService();
  const watchService = new WatchRulesService(undefined, undefined, tempDir);

  describe('ActionPreparationService', () => {
    it('should prepare a block IP action without immediate execution', () => {
      const act = actionService.prepareBlockIp('142.250.72.14', 'Suspicious outbound traffic', 'Ollama');
      expect(act.id).toBeDefined();
      expect(act.actionType).toBe('PREPARE_BLOCK_IP');
      expect(act.target).toBe('142.250.72.14');
      expect(act.status).toBe('PENDING');
      expect(act.impactDescription).toContain('com.networkmonitor.app');
    });

    it('should prepare a kill process action with safe impact preview', () => {
      const act = actionService.prepareKillProcess(4218, 'SIGTERM', 'High CPU consumption', 'Ollama');
      expect(act.actionType).toBe('PREPARE_KILL_PROCESS');
      expect(act.target).toBe('4218');
      expect(act.status).toBe('PENDING');
    });

    it('should parse natural language filter criteria', () => {
      const filter1 = actionService.parseNaturalLanguageFilter('Show connections from AI agents using more than 1 MB/s');
      expect(filter1.isAiOnly).toBe(true);
      expect(filter1.minThroughputBytesPerSec).toBe(1048576);

      const filter2 = actionService.parseNaturalLanguageFilter('Show processes connecting to more than 10 different IPs on TCP');
      expect(filter2.minRemoteIpsCount).toBe(10);
      expect(filter2.protocol).toBe('TCP');
    });
  });

  describe('WatchRulesService', () => {
    it('should manage watch rules and evaluate non-destructive triggers', () => {
      const rule = watchService.createRule({
        name: 'Test Claude Watch',
        targetType: 'agent',
        targetName: 'Claude Code',
        triggerType: 'NEW_ENDPOINT',
        action: 'NOTIFY',
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Test Claude Watch');

      watchService.evaluateEvent('NEW_ENDPOINT', 'Claude Code');
      const updated = watchService.listRules().find((r) => r.id === rule.id);
      expect(updated?.triggerCount).toBe(1);

      const deleted = watchService.deleteRule(rule.id);
      expect(deleted).toBe(true);
    });
  });
});
