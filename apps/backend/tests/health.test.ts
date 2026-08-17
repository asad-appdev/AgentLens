import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('GET /api/health', () => {
  let appServer: AppServer;

  const testConfig: ServerConfig = {
    host: '127.0.0.1',
    port: 3099,
    nodeEnv: 'test',
    wsHeartbeatIntervalMs: 60000,
    connectionPollIntervalMs: 2000,
    dryRunMode: true,
    allowPrivilegedOperations: false,
  };

  beforeAll(async () => {
    appServer = new AppServer(testConfig);
    await appServer.start();
  });

  afterAll(async () => {
    await appServer.stop();
  });

  it('should return 200 OK with status "ok"', async () => {
    const response = await request(appServer.app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('platform');
  });

  it('should return 404 for unknown endpoints', async () => {
    const response = await request(appServer.app).get('/api/non-existent-route');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
