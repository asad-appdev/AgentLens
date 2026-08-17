import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

export class LoggerService {
  private readonly logDir: string;
  private readonly logFilePath: string;
  private minLevel: LogLevel = 'INFO';
  private readonly maxFileSizeBytes = 20 * 1024 * 1024; // 20 MB
  private readonly maxBackupFiles = 5;
  private readonly recentErrors: Array<{ timestamp: string; level: string; message: string }> = [];

  constructor(customDir?: string) {
    this.logDir = customDir ?? path.join(os.homedir(), '.network-monitor', 'logs');
    this.logFilePath = path.join(this.logDir, 'app.log');
    this.ensureLogDir();
  }

  public setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public debug(message: string, ...args: unknown[]): void {
    this.log('DEBUG', message, ...args);
  }

  public info(message: string, ...args: unknown[]): void {
    this.log('INFO', message, ...args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.log('WARN', message, ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.log('ERROR', message, ...args);
  }

  public getRecentErrors(): Array<{ timestamp: string; level: string; message: string }> {
    return [...this.recentErrors];
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (LOG_LEVEL_WEIGHTS[level] < LOG_LEVEL_WEIGHTS[this.minLevel]) {
      return;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const sanitizedMsg = this.sanitize(message);
    const formattedArgs = args.length > 0 ? ' ' + args.map((a) => this.sanitize(String(a))).join(' ') : '';
    const logLine = `${timestamp} ${level.padEnd(5)} ${sanitizedMsg}${formattedArgs}`;

    // Console output
    if (level === 'ERROR') {
      console.error(logLine);
    } else if (level === 'WARN') {
      console.warn(logLine);
    } else {
      console.log(logLine);
    }

    if (level === 'ERROR' || level === 'WARN') {
      this.recentErrors.unshift({ timestamp: new Date().toISOString(), level, message: sanitizedMsg });
      if (this.recentErrors.length > 50) this.recentErrors.pop();
    }

    this.writeToFile(logLine);
  }

  private writeToFile(line: string): void {
    try {
      this.ensureLogDir();
      this.rotateIfNeeded();
      fs.appendFileSync(this.logFilePath, line + '\n', 'utf-8');
    } catch {
      // Fail silently to prevent logging recursion
    }
  }

  private rotateIfNeeded(): void {
    try {
      if (!fs.existsSync(this.logFilePath)) return;
      const stats = fs.statSync(this.logFilePath);
      if (stats.size < this.maxFileSizeBytes) return;

      // Rotate existing logs: app.log.4 -> app.log.5, etc.
      for (let i = this.maxBackupFiles - 1; i >= 1; i--) {
        const src = path.join(this.logDir, `app.log.${i}`);
        const dest = path.join(this.logDir, `app.log.${i + 1}`);
        if (fs.existsSync(src)) {
          fs.renameSync(src, dest);
        }
      }
      fs.renameSync(this.logFilePath, path.join(this.logDir, 'app.log.1'));
    } catch {
      // Best-effort rotation
    }
  }

  private sanitize(input: string): string {
    return input
      .replace(/password\s*=\s*[^\s&]+/gi, 'password=***')
      .replace(/token\s*=\s*[^\s&]+/gi, 'token=***')
      .replace(/secret\s*=\s*[^\s&]+/gi, 'secret=***')
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer ***');
  }

  private ensureLogDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch {
      // Directory creation error
    }
  }
}

export const logger = new LoggerService();
