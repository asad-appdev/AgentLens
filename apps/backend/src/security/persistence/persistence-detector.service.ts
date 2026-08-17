import {
  PersistenceMechanism,
  PersistencePlatform,
} from '@network-monitor/shared';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { logger } from '../../services/logger.service.js';

export class PersistenceDetectorService {
  private knownItems = new Map<string, PersistenceMechanism>();

  /**
   * Scans system startup and persistence mechanisms safely across macOS and Windows.
   */
  public async scanPersistence(): Promise<PersistenceMechanism[]> {
    const platform: PersistencePlatform = process.platform === 'win32' ? 'win32' : 'darwin';
    const discovered: PersistenceMechanism[] = [];

    if (platform === 'darwin') {
      // 1. Scan macOS LaunchAgents & LaunchDaemons
      const launchDirs = [
        path.join(os.homedir(), 'Library/LaunchAgents'),
        '/Library/LaunchAgents',
        '/Library/LaunchDaemons',
      ];

      for (const dir of launchDirs) {
        if (fs.existsSync(dir)) {
          try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
              if (file.endsWith('.plist')) {
                const fullPath = path.join(dir, file);
                const id = `pers-darwin-${file}`;
                const isKnown = this.knownItems.has(id);

                const item: PersistenceMechanism = {
                  id,
                  platform: 'darwin',
                  type: dir.includes('Daemon') ? 'launch_daemon' : 'launch_agent',
                  name: file,
                  targetPath: fullPath,
                  discoveredAt: new Date().toISOString(),
                  isSuspicious: !isKnown && (file.toLowerCase().includes('agent') || file.toLowerCase().includes('ai')),
                  suspicionReason: !isKnown ? 'Newly observed LaunchAgent item in user domain' : undefined,
                };
                discovered.push(item);
                this.knownItems.set(id, item);
              }
            }
          } catch (err) {
            logger.warn(`[PersistenceDetector] Error reading macOS directory ${dir}: ${err}`);
          }
        }
      }
    } else {
      // 2. Windows persistence locations (Startup Folder)
      const appData = process.env.APPDATA || '';
      if (appData) {
        const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        if (fs.existsSync(startupDir)) {
          try {
            const files = fs.readdirSync(startupDir);
            for (const file of files) {
              const fullPath = path.join(startupDir, file);
              const id = `pers-win-${file}`;
              const item: PersistenceMechanism = {
                id,
                platform: 'win32',
                type: 'registry_run',
                name: file,
                targetPath: fullPath,
                discoveredAt: new Date().toISOString(),
                isSuspicious: file.toLowerCase().includes('agent') || file.toLowerCase().includes('bot'),
                suspicionReason: 'Observed executable / shortcut in Windows Startup directory',
              };
              discovered.push(item);
              this.knownItems.set(id, item);
            }
          } catch (err) {
            logger.warn(`[PersistenceDetector] Error reading Windows Startup dir: ${err}`);
          }
        }
      }
    }

    return discovered;
  }

  /**
   * Retrieves all cached persistence items.
   */
  public getPersistenceItems(): PersistenceMechanism[] {
    return Array.from(this.knownItems.values());
  }
}

export const persistenceDetectorService = new PersistenceDetectorService();
