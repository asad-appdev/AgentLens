import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';
import { macosService } from '../src/services/macos.service.js';

describe('GET /api/traffic (Integration Test)', () => {
  let appServer: AppServer;
  const testPort = 3110;


  const testConfig: ServerConfig = {
    host: '127.0.0.1',
    port: testPort,
    nodeEnv: 'test',
    wsHeartbeatIntervalMs: 60000,
    connectionPollIntervalMs: 2000,
    dryRunMode: true,
    allowPrivilegedOperations: false,
  };

  beforeAll(() => {
    appServer = new AppServer(testConfig);
  });

  afterAll(async () => {
    await appServer.stop();
    vi.restoreAllMocks();
  });

  it('should return 200 OK with process traffic summary', async () => {
    vi.spyOn(macosService, 'sampleTraffic').mockResolvedValueOnce({
      timestamp: '2026-08-15T01:00:00.000Z',
      totalProcesses: 2,
      activeProcesses: 1,
      totalBytesInPerSecond: 10240,
      totalBytesOutPerSecond: 2048,
      processes: [
        {
          pid: 4218,
          processName: 'ollama',
          bytesIn: 100000,
          bytesOut: 20000,
          bytesInPerSecond: 10240,
          bytesOutPerSecond: 2048,
          totalBytesPerSecond: 12288,
          activity: 'ACTIVE',
          isAiAgent: true,
          aiAgentName: 'Ollama',
          lastUpdated: Date.now(),
        },
        {
          pid: 1234,
          processName: 'node',
          bytesIn: 500,
          bytesOut: 500,
          bytesInPerSecond: 0,
          bytesOutPerSecond: 0,
          totalBytesPerSecond: 0,
          activity: 'IDLE',
          isAiAgent: false,
          lastUpdated: Date.now(),
        },
      ],
    });

    const response = await request(appServer.app).get('/api/traffic');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('totalProcesses', 2);
    expect(response.body).toHaveProperty('activeProcesses', 1);
    expect(response.body).toHaveProperty('totalBytesInPerSecond', 10240);
    expect(response.body).toHaveProperty('processes');
    expect(Array.isArray(response.body.processes)).toBe(true);

    const first = response.body.processes[0];
    expect(first.pid).toBe(4218);
    expect(first.processName).toBe('ollama');
    expect(first.isAiAgent).toBe(true);
  });
});
