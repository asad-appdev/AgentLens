import { CommandRunnerService, commandRunner, CommandExecutionResult } from './command-runner.service.js';
import { PF_APPLICATION_ANCHOR } from '@network-monitor/shared';

export interface IPfCommandRunner {
  loadAnchorRules(rulesFilePath: string, anchorName?: string): Promise<CommandExecutionResult>;
  clearAnchorRules(anchorName?: string): Promise<CommandExecutionResult>;
  getAnchorRules(anchorName?: string): Promise<CommandExecutionResult>;
  checkPfStatus(): Promise<CommandExecutionResult>;
  isDryRun(): boolean;
}

export class PfCommandRunnerService implements IPfCommandRunner {
  private readonly runner: CommandRunnerService;
  private readonly dryRun: boolean;

  constructor(runner: CommandRunnerService = commandRunner, dryRun: boolean = true) {
    this.runner = runner;
    this.dryRun = dryRun;
  }

  public isDryRun(): boolean {
    return this.dryRun;
  }

  /**
   * Loads rule file into dedicated anchor: `pfctl -a <anchor> -f <rulesFilePath>`
   */
  public async loadAnchorRules(
    rulesFilePath: string,
    anchorName: string = PF_APPLICATION_ANCHOR
  ): Promise<CommandExecutionResult> {
    if (this.dryRun) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[PF Simulation] Loaded rules into anchor "${anchorName}" from file "${rulesFilePath}"`);
      }
      return { stdout: `Anchor ${anchorName} rules loaded (dry-run simulation)`, stderr: '', exitCode: 0 };
    }

    // Explicit argument array with fixed anchor and rules file
    return this.runner.execute('pfctl', ['-a', anchorName, '-f', rulesFilePath]);
  }

  /**
   * Clears rules in dedicated anchor only: `pfctl -a <anchor> -F rules`
   * NEVER flushes global rules.
   */
  public async clearAnchorRules(anchorName: string = PF_APPLICATION_ANCHOR): Promise<CommandExecutionResult> {
    if (this.dryRun) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[PF Simulation] Cleared rules in anchor "${anchorName}"`);
      }
      return { stdout: `Anchor ${anchorName} rules cleared (dry-run simulation)`, stderr: '', exitCode: 0 };
    }

    return this.runner.execute('pfctl', ['-a', anchorName, '-F', 'rules']);
  }

  /**
   * Reads current active rules from dedicated anchor: `pfctl -a <anchor> -sr`
   */
  public async getAnchorRules(anchorName: string = PF_APPLICATION_ANCHOR): Promise<CommandExecutionResult> {
    if (this.dryRun) {
      return { stdout: `# Anchor ${anchorName} active in simulation mode`, stderr: '', exitCode: 0 };
    }

    return this.runner.execute('pfctl', ['-a', anchorName, '-sr']);
  }

  /**
   * Checks general PF subsystem info: `pfctl -s info`
   */
  public async checkPfStatus(): Promise<CommandExecutionResult> {
    if (this.dryRun) {
      return { stdout: 'Status: Enabled (Simulation)', stderr: '', exitCode: 0 };
    }

    return this.runner.execute('pfctl', ['-s', 'info']);
  }
}

export const pfCommandRunner = new PfCommandRunnerService(commandRunner, process.env.ENABLE_DRY_RUN_MODE !== 'false');
