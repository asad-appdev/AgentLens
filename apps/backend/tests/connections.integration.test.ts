import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';
import { macosService } from '../src/services/macos.service.js';

describe('GET /api/connections (Integration Test)', () => {
  let appServer: AppServer;
  const testPort = 3107;


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

  it('should return 200 OK with formatted connections snapshot', async () => {
    // Mock getNetworkConnections to avoid dependency on host network state
    vi.spyOn(macosService, 'getNetworkConnections').mockResolvedValueOnce([
      {
        id: 'tcp-1234-127.0.0.1-3000-*-*-listen',
        protocol: 'TCP',
        localAddress: '127.0.0.1',
        localPort: 3000,
        remoteAddress: null,
        remotePort: null,
        state: 'LISTEN',
        processName: 'node',
        pid: 1234,
        ipVersion: 'IPv4',
        isListening: true,
        discoveredAt: '2026-08-15T00:00:00.000Z',
      },
    ]);

    const response = await request(appServer.app).get('/api/connections');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('total', 1);
    expect(response.body).toHaveProperty('connections');
    expect(Array.isArray(response.body.connections)).toBe(true);

    const first = response.body.connections[0];
    expect(first.id).toBe('tcp-1234-127.0.0.1-3000-*-*-listen');
    expect(first.processName).toBe('node');
    expect(first.pid).toBe(1234);
    expect(first.localPort).toBe(3000);
    expect(first.state).toBe('LISTEN');
  });

  it('should handle service errors gracefully and return 500 error envelope', async () => {
    vi.spyOn(macosService, 'getNetworkConnections').mockRejectedValueOnce(
      new Error('lsof binary missing or permission failure')
    );

    const response = await request(appServer.app).get('/api/connections');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toContain('lsof binary missing');
  });
});
