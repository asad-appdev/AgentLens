import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('Local Servers & Port Cleanup API Integration Tests', () => {
  let appServer: AppServer;
  const testPort = 3103;


  const testConfig: ServerConfig = {
    host: '127.0.0.1',
    port: testPort,
    nodeEnv: 'test',
    wsHeartbeatIntervalMs: 60000,
    connectionPollIntervalMs: 2000,
    dryRunMode: true,
    allowPrivilegedOperations: true,
  };

  beforeAll(() => {
    appServer = new AppServer(testConfig);
  });

  afterAll(async () => {
    await appServer.stop();
  });

  it('GET /api/local-servers - should return list of listening servers', async () => {
    const res = await request(appServer.app).get('/api/local-servers');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('servers');
    expect(Array.isArray(res.body.servers)).toBe(true);
    expect(res.body).toHaveProperty('count');
  });

  it('POST /api/kill-port - should validate port number parameter', async () => {
    const res = await request(appServer.app)
      .post('/api/kill-port')
      .send({ port: -1 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/kill-processes - should validate pids and ports arrays', async () => {
    const res = await request(appServer.app)
      .post('/api/kill-processes')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/kill-processes - should process non-existent port safely', async () => {
    const res = await request(appServer.app)
      .post('/api/kill-processes')
      .send({ ports: [59998], signal: 'SIGTERM' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('results');
  });
});
