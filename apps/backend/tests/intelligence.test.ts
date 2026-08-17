import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SettingsService } from '../src/services/settings.service.js';
import { NotificationService } from '../src/services/notification.service.js';
import { ProcessRelationshipService } from '../src/services/process-relationship.service.js';
import { CommandRunnerService } from '../src/services/command-runner.service.js';

describe('Settings & Intelligence Unit Tests (Phase 9)', () => {
  let tempDir: string;
  let settingsService: SettingsService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-test-settings-'));
    settingsService = new SettingsService(tempDir);
  });

  it('should initialize with default user settings', () => {
    const settings = settingsService.getSettings();
    expect(settings.connectionPollingIntervalMs).toBe(1500);
    expect(settings.highTrafficAlertThresholdMbps).toBe(10);
    expect(settings.notificationRules.newAiAgent).toBe(true);
    expect(settings.filterPresets.length).toBeGreaterThanOrEqual(4);
  });

  it('should toggle and persist favorites', () => {
    expect(settingsService.isFavorite(101, 'ollama')).toBe(false);

    const isFav = settingsService.toggleFavorite(101, 'ollama');
    expect(isFav).toBe(true);
    expect(settingsService.isFavorite(101, 'ollama')).toBe(true);

    const isFav2 = settingsService.toggleFavorite(101, 'ollama');
    expect(isFav2).toBe(false);
    expect(settingsService.isFavorite(101, 'ollama')).toBe(false);
  });

  it('should set and retrieve custom process labels and tags', () => {
    settingsService.setProcessLabel('ollama', 'Local LLM Server');
    expect(settingsService.getProcessLabel('ollama')).toBe('Local LLM Server');

    settingsService.setTags('ollama', ['AI', 'Development', 'Local']);
    expect(settingsService.getTags('ollama')).toEqual(['AI', 'Development', 'Local']);
  });

  it('should update partial settings cleanly', () => {
    settingsService.updateSettings({
      highTrafficAlertThresholdMbps: 25,
      compactMode: true,
    });

    const updated = settingsService.getSettings();
    expect(updated.highTrafficAlertThresholdMbps).toBe(25);
    expect(updated.compactMode).toBe(true);
  });
});

describe('NotificationService & Rule Engine', () => {
  let tempDir: string;
  let settings: SettingsService;
  let notifService: NotificationService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nm-test-notif-'));
    settings = new SettingsService(tempDir);
    notifService = new NotificationService(settings);
  });

  it('should push local events with deduplication cooldown', () => {
    const first = notifService.pushEvent('high_traffic', 'WARNING', 'High Traffic', 'Process high throughput', { pid: 4218 });
    expect(first).toBe(true);
    expect(notifService.getEvents()).toHaveLength(1);
    expect(notifService.getUnreadCount()).toBe(1);

    // Immediate duplicate trigger within 60s cooldown must be dropped
    const duplicate = notifService.pushEvent('high_traffic', 'WARNING', 'High Traffic', 'Process high throughput', { pid: 4218 });
    expect(duplicate).toBe(false);
    expect(notifService.getEvents()).toHaveLength(1);
  });

  it('should evaluate rule triggers for AI agent detection and high traffic', () => {
    notifService.evaluateRules(
      [
        { pid: 501, processName: 'ollama', remoteAddress: '142.250.72.14', isAiAgent: true, aiAgentName: 'Ollama' },
      ],
      [
        { pid: 501, processName: 'ollama', bytesInPerSecond: 15 * 1024 * 1024, bytesOutPerSecond: 2 * 1024 * 1024 }, // 17 MB/s > 10 MB/s
      ]
    );

    const events = notifService.getEvents();
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => e.type === 'new_ai_agent')).toBe(true);
    expect(events.some((e) => e.type === 'high_traffic')).toBe(true);
  });

  it('should mark events as read and clear event history', () => {
    notifService.pushEvent('new_ai_agent', 'INFO', 'AI Agent', 'Ollama started');
    expect(notifService.getUnreadCount()).toBe(1);

    notifService.markAllRead();
    expect(notifService.getUnreadCount()).toBe(0);

    notifService.clearEvents();
    expect(notifService.getEvents()).toHaveLength(0);
  });
});

describe('ProcessRelationshipService', () => {
  it('should parse raw ps hierarchy without errors', async () => {
    const mockRunner: CommandRunnerService = {
      execute: async () => ({
        stdout: `  PID  PPID COMM ARGS
    1     0 /sbin/launchd /sbin/launchd
  100     1 /usr/libexec/syslogd /usr/libexec/syslogd
  4218   100 /usr/local/bin/ollama ollama serve
  4220  4218 /usr/local/bin/runner runner --model llama`,
        stderr: '',
        exitCode: 0,
      }),
    } as any;

    const relationshipService = new ProcessRelationshipService(mockRunner);
    const list = await relationshipService.getRawProcessList();
    expect(list.length).toBe(4);
    expect(list[2]!.pid).toBe(4218);
    expect(list[2]!.ppid).toBe(100);

    const family = await relationshipService.getProcessFamily(4218);
    expect(family.parent?.pid).toBe(100);
    expect(family.children[0]?.pid).toBe(4220);
  });
});
