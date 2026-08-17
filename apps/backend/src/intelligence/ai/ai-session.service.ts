import { AiAgentSession } from '@network-monitor/shared';

export class AiAgentSessionService {
  private readonly activeSessions = new Map<string, AiAgentSession>(); // sessionId -> session
  private readonly historicalSessions: AiAgentSession[] = [];
  private readonly maxHistoricalSessions = 500;

  /**
   * Updates or registers an observation for an AI agent session.
   */
  public updateSessionObservation(
    agentId: string,
    displayName: string,
    rootPid: number,
    bytesInRate: number,
    bytesOutRate: number,
    remoteIps: string[] = [],
    childPids: number[] = []
  ): AiAgentSession {
    const sessionKey = `${agentId}:${rootPid}`;
    const now = new Date().toISOString();

    let session = this.activeSessions.get(sessionKey);

    if (!session) {
      session = {
        sessionId: `sess-${agentId}-${rootPid}-${Date.now()}`,
        agentId,
        displayName,
        rootPid,
        status: 'ACTIVE',
        startTime: now,
        lastSeen: now,
        bytesIn: 0,
        bytesOut: 0,
        connectionCount: remoteIps.length,
        uniqueRemoteIps: Array.from(new Set(remoteIps.filter(Boolean))),
        childPids: Array.from(new Set(childPids)),
      };
      this.activeSessions.set(sessionKey, session);
    } else {
      session.lastSeen = now;
      session.bytesIn += bytesInRate * 5; // scaled for 5s aggregate tick
      session.bytesOut += bytesOutRate * 5;
      session.connectionCount = remoteIps.length;
      for (const ip of remoteIps) {
        if (ip && !session.uniqueRemoteIps.includes(ip)) {
          session.uniqueRemoteIps.push(ip);
        }
      }
      for (const cpid of childPids) {
        if (!session.childPids.includes(cpid)) {
          session.childPids.push(cpid);
        }
      }

      // Detect active vs idle based on traffic
      session.status = (bytesInRate + bytesOutRate > 1024) ? 'ACTIVE' : 'IDLE';
    }

    return session;
  }

  /**
   * Ends an active session when PID disappears from monitor.
   */
  public endSession(sessionKey: string): void {
    const session = this.activeSessions.get(sessionKey);
    if (!session) return;

    session.status = 'ENDED';
    session.endTime = new Date().toISOString();
    this.historicalSessions.unshift({ ...session });

    if (this.historicalSessions.length > this.maxHistoricalSessions) {
      this.historicalSessions.pop();
    }

    this.activeSessions.delete(sessionKey);
  }

  public getActiveSessions(): AiAgentSession[] {
    return Array.from(this.activeSessions.values());
  }

  public getSessionsForAgent(agentId: string): AiAgentSession[] {
    const active = Array.from(this.activeSessions.values()).filter((s) => s.agentId === agentId);
    const historical = this.historicalSessions.filter((s) => s.agentId === agentId);
    return [...active, ...historical];
  }

  public getSessionById(sessionId: string): AiAgentSession | undefined {
    return (
      Array.from(this.activeSessions.values()).find((s) => s.sessionId === sessionId) ||
      this.historicalSessions.find((s) => s.sessionId === sessionId)
    );
  }
}

export const aiAgentSessionService = new AiAgentSessionService();
