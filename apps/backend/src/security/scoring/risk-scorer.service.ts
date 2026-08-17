import {
  SecurityRiskBreakdown,
  SecurityRiskFactor,
  SecuritySeverity,
} from '@network-monitor/shared';

export class RiskScorerService {
  /**
   * Evaluates a collection of risk factors to produce a 0-100 explainable score and level.
   */
  public evaluate(factors: SecurityRiskFactor[]): SecurityRiskBreakdown {
    let rawScore = 0;

    for (const f of factors) {
      rawScore += f.delta;
    }

    // Clamp score between 0 and 100
    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    let level: SecuritySeverity = 'INFO';
    if (finalScore >= 80) {
      level = 'CRITICAL';
    } else if (finalScore >= 60) {
      level = 'HIGH';
    } else if (finalScore >= 35) {
      level = 'MEDIUM';
    } else if (finalScore >= 15) {
      level = 'LOW';
    }

    return {
      score: finalScore,
      level,
      factors: [...factors],
      lastEvaluated: new Date().toISOString(),
    };
  }

  /**
   * Helper to create standard explainable risk factors.
   */
  public createFactor(
    delta: number,
    reason: string,
    evidence: string,
    category: SecurityRiskFactor['category'] = 'process'
  ): SecurityRiskFactor {
    return {
      id: `factor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      delta,
      reason,
      evidence,
      timestamp: new Date().toISOString(),
      category,
    };
  }
}

export const riskScorerService = new RiskScorerService();
