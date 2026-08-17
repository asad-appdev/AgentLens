import { describe, it, expect } from 'vitest';
import { aiAgentDetector } from '../src/intelligence/ai/ai-agent-detector.js';
import { sensitiveFileDetectorService } from '../src/security/files/sensitive-file-detector.service.js';
import { riskScorerService } from '../src/security/scoring/risk-scorer.service.js';
import { SecurityAlertsService } from '../src/security/alerts/security-alerts.service.js';
import { SecurityTimelineService } from '../src/security/timeline/security-timeline.service.js';
import { SecurityCorrelationEngine } from '../src/security/correlation/security-correlation-engine.service.js';

describe('AI Agent Multi-Signal Detection', () => {
  it('detects Claude Code agent CLI with high confidence and evidence', () => {
    const res = aiAgentDetector.detect(101, 'claude', 'node /usr/local/bin/claude --agent');
    expect(res).not.toBeNull();
    expect(res?.displayName).toContain('Claude');
    expect(res?.confidenceScore).toBeGreaterThanOrEqual(0.7);
    expect(res?.evidence.length).toBeGreaterThan(0);
  });

  it('detects Ollama local server runtime', () => {
    const res = aiAgentDetector.detect(102, 'ollama', '/usr/local/bin/ollama serve');
    expect(res).not.toBeNull();
    expect(res?.displayName).toContain('Ollama');
    expect(res?.category).toBe('local-runtime');
  });

  it('rejects generic node process without agent signatures (prevent false positives)', () => {
    const res = aiAgentDetector.detect(103, 'node', 'node /Users/user/app/server.js');
    expect(res).toBeNull();
  });

  it('rejects generic python runtime process', () => {
    const res = aiAgentDetector.detect(104, 'python3', 'python3 -m http.server 8080');
    expect(res).toBeNull();
  });
});

describe('Sensitive File Access Classifier (Zero Content Guarantee)', () => {
  it('correctly classifies SSH private keys with critical sensitivity', () => {
    const classification = sensitiveFileDetectorService.classifyPath('/Users/developer/.ssh/id_rsa');
    expect(classification).not.toBeNull();
    expect(classification?.category).toBe('ssh');
    expect(classification?.sensitivity).toBe('critical');
  });

  it('correctly classifies AWS credential files as cloud credentials', () => {
    const classification = sensitiveFileDetectorService.classifyPath('/Users/developer/.aws/credentials');
    expect(classification).not.toBeNull();
    expect(classification?.category).toBe('cloud');
    expect(classification?.sensitivity).toBe('critical');
  });

  it('correctly classifies .env files as credentials category', () => {
    const classification = sensitiveFileDetectorService.classifyPath('/Users/developer/project/.env.production');
    expect(classification).not.toBeNull();
    expect(classification?.category).toBe('credentials');
    expect(classification?.sensitivity).toBe('high');
  });

  it('ignores standard workspace source files', () => {
    const classification = sensitiveFileDetectorService.classifyPath('/Users/developer/project/src/index.ts');
    expect(classification).toBeNull();
  });
});

describe('Explainable Risk Scorer (0-100 Score with Breakdown)', () => {
  it('computes 0 score for empty risk factors', () => {
    const score = riskScorerService.evaluate([]);
    expect(score.score).toBe(0);
    expect(score.level).toBe('INFO');
    expect(score.factors.length).toBe(0);
  });

  it('computes high risk score with explainable factor deltas when multiple signals are observed', () => {
    const factors = [
      riskScorerService.createFactor(30, 'Sensitive file accessed', '/.aws/credentials', 'file'),
      riskScorerService.createFactor(25, 'Unseen outbound destination', '198.51.100.45:443', 'network'),
      riskScorerService.createFactor(20, 'Unusual child process executed', 'powershell -enc', 'process'),
    ];
    const score = riskScorerService.evaluate(factors);
    expect(score.score).toBe(75);
    expect(score.level).toBe('HIGH');
    expect(score.factors.length).toBe(3);
  });
});

describe('Deterministic Security Correlation Engine', () => {
  it('correlates sensitive file access + new outbound destination into High Alert with 5-part breakdown', () => {
    const alertsService = new SecurityAlertsService();
    const timelineService = new SecurityTimelineService();
    const correlationEngine = new SecurityCorrelationEngine(alertsService, timelineService);

    // 1. Agent accesses sensitive AWS credentials
    correlationEngine.handleSensitiveFileAccess({
      id: 'acc-1',
      agentId: 'claude-code',
      pid: 1234,
      processName: 'claude',
      path: '/Users/developer/.aws/credentials',
      category: 'cloud',
      sensitivity: 'critical',
      timestamp: new Date().toISOString(),
      wasBlocked: false,
    });

    // 2. Agent establishes connection to unknown external endpoint within 10 minutes
    const alert = correlationEngine.handleOutboundDestination(
      1234,
      'claude-code',
      'claude',
      '198.51.100.45',
      443,
      54200,
      true
    );

    expect(alert).not.toBeNull();
    expect(alert?.title).toBe('Potential Sensitive-Data Exposure');
    expect(alert?.severity).toBe('HIGH');
    expect(alert?.evidence.length).toBeGreaterThanOrEqual(2);
    expect(alert?.whySuspicious).toContain('.aws/credentials');
    expect(alert?.whatIsUnknown).toBeDefined();
    expect(alert?.recommendation).toBeDefined();
    expect(alert?.actions.some((a) => a.type === 'BLOCK_DESTINATION')).toBe(true);
  });
});
