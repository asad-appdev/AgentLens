import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { UserAppSettings, FilterPreset } from '@network-monitor/shared';

const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: 'ai-activity',
    name: 'AI Agent Activity',
    description: 'Filter connections from local AI runtimes (Ollama, LM Studio, Claude, etc.)',
    filters: { isAiAgentOnly: true },
  },
  {
    id: 'high-traffic',
    name: 'High Traffic Sockets',
    description: 'Sockets transferring > 100 KB/s',
    filters: { minTrafficBytesPerSec: 102400 },
  },
  {
    id: 'active-tcp',
    name: 'Active TCP Connections',
    description: 'Established TCP sockets with active data flow',
    filters: { protocols: ['TCP'], states: ['ESTABLISHED'] },
  },
  {
    id: 'local-network',
    name: 'Local Network (LAN)',
    description: 'Connections on private IP subnets',
    filters: { tags: ['Local Network'] },
  },
];

export const DEFAULT_APP_SETTINGS: UserAppSettings = {
  connectionPollingIntervalMs: 1500,
  trafficAggregationIntervalMs: 5000,
  historyRecordingEnabled: true,
  trafficActiveThresholdBytesPerSec: 1024,
  highTrafficAlertThresholdMbps: 10,
  notificationRules: {
    newAiAgent: true,
    highTraffic: true,
    newRemoteIp: false,
    blockedIpObserved: true,
  },
  dashboardLayout: {
    panels: [
      { id: 'traffic', name: 'Live Traffic', visible: true, order: 0 },
      { id: 'processes', name: 'Active Processes', visible: true, order: 1 },
      { id: 'ai-agents', name: 'AI Agents', visible: true, order: 2 },
      { id: 'connections', name: 'Sockets & Connections', visible: true, order: 3 },
      { id: 'firewall', name: 'Blocked IPs', visible: true, order: 4 },
      { id: 'history', name: 'History & Analytics', visible: true, order: 5 },
      { id: 'events', name: 'Event Center', visible: true, order: 6 },
    ],
  },
  compactMode: false,
  favoritePids: [],
  favoriteProcessNames: [],
  customProcessLabels: {},
  processTags: {},
  filterPresets: DEFAULT_PRESETS,
};

export class SettingsService {
  private settings: UserAppSettings;
  private readonly settingsFilePath: string;

  constructor(dataDir?: string) {
    const dir = dataDir ?? path.join(os.homedir(), '.network-monitor');
    this.settingsFilePath = path.join(dir, 'settings.json');
    this.settings = this.loadSettings(dir);
  }

  public getSettings(): UserAppSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<UserAppSettings>): UserAppSettings {
    this.settings = {
      ...this.settings,
      ...partial,
      notificationRules: {
        ...this.settings.notificationRules,
        ...(partial.notificationRules || {}),
      },
      dashboardLayout: {
        ...this.settings.dashboardLayout,
        ...(partial.dashboardLayout || {}),
      },
    };
    this.saveSettings();
    return this.getSettings();
  }

  public toggleFavorite(pid: number, processName: string): boolean {
    const isFav = this.settings.favoriteProcessNames.includes(processName) || this.settings.favoritePids.includes(pid);
    if (isFav) {
      this.settings.favoriteProcessNames = this.settings.favoriteProcessNames.filter((n) => n !== processName);
      this.settings.favoritePids = this.settings.favoritePids.filter((p) => p !== pid);
    } else {
      if (processName && !this.settings.favoriteProcessNames.includes(processName)) {
        this.settings.favoriteProcessNames.push(processName);
      }
      if (!this.settings.favoritePids.includes(pid)) {
        this.settings.favoritePids.push(pid);
      }
    }
    this.saveSettings();
    return !isFav;
  }

  public isFavorite(pid: number, processName: string): boolean {
    return (
      this.settings.favoritePids.includes(pid) ||
      (!!processName && this.settings.favoriteProcessNames.includes(processName))
    );
  }

  public setProcessLabel(key: string, label?: string): void {
    if (label && label.trim()) {
      this.settings.customProcessLabels[key] = label.trim();
    } else {
      delete this.settings.customProcessLabels[key];
    }
    this.saveSettings();
  }

  public getProcessLabel(key: string): string | undefined {
    return this.settings.customProcessLabels[key];
  }

  public setTags(key: string, tags: string[]): void {
    if (tags && tags.length > 0) {
      this.settings.processTags[key] = tags;
    } else {
      delete this.settings.processTags[key];
    }
    this.saveSettings();
  }

  public getTags(key: string): string[] {
    return this.settings.processTags[key] || [];
  }

  private loadSettings(dir: string): UserAppSettings {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.settingsFilePath)) {
        const content = fs.readFileSync(this.settingsFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          ...DEFAULT_APP_SETTINGS,
          ...parsed,
          notificationRules: { ...DEFAULT_APP_SETTINGS.notificationRules, ...(parsed.notificationRules || {}) },
          dashboardLayout: { ...DEFAULT_APP_SETTINGS.dashboardLayout, ...(parsed.dashboardLayout || {}) },
          filterPresets: parsed.filterPresets?.length ? parsed.filterPresets : DEFAULT_PRESETS,
        };
      }
    } catch (err) {
      console.warn('[SettingsService] Failed to load settings.json, using defaults:', err);
    }
    return { ...DEFAULT_APP_SETTINGS };
  }

  private saveSettings(): void {
    try {
      const tempPath = `${this.settingsFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.settings, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.settingsFilePath);
    } catch (err) {
      console.error('[SettingsService] Error writing settings.json:', err);
    }
  }
}

export const settingsService = new SettingsService();
