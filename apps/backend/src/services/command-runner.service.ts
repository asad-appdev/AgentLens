import { execFile, ExecFileOptions } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface CommandExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CommandRunnerOptions {
  timeoutMs?: number;
  maxBufferBytes?: number;
}

/**
 * Safe Command Runner that strictly executes binaries with argument arrays.
 * NEVER uses shell string interpolation (e.g. child_process.exec).
 */
export class CommandRunnerService {
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxBufferBytes: number;

  constructor(options: CommandRunnerOptions = {}) {
    this.defaultTimeoutMs = options.timeoutMs ?? 5000;
    this.defaultMaxBufferBytes = options.maxBufferBytes ?? 10 * 1024 * 1024; // 10MB
  }

  /**
   * Executes a command using execFile with an explicit argument list.
   */
  public async execute(
    binaryPath: string,
    args: string[] = [],
    options: ExecFileOptions = {}
  ): Promise<CommandExecutionResult> {
    const mergedOptions: ExecFileOptions = {
      timeout: this.defaultTimeoutMs,
      maxBuffer: this.defaultMaxBufferBytes,
      windowsHide: true,
      ...options,
    };

    try {
      const { stdout, stderr } = await execFileAsync(binaryPath, args, mergedOptions);
      return {
        stdout: typeof stdout === 'string' ? stdout : stdout.toString('utf-8'),
        stderr: typeof stderr === 'string' ? stderr : stderr.toString('utf-8'),
        exitCode: 0,
      };
    } catch (error: unknown) {
      const err = error as { code?: number; stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
      return {
        stdout: err.stdout ? (typeof err.stdout === 'string' ? err.stdout : err.stdout.toString('utf-8')) : '',
        stderr: err.stderr ? (typeof err.stderr === 'string' ? err.stderr : err.stderr.toString('utf-8')) : (err.message || 'Unknown execution error'),
        exitCode: typeof err.code === 'number' ? err.code : 1,
      };
    }
  }
}

export const commandRunner = new CommandRunnerService();
