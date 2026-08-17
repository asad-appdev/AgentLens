import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('Windows & Cross-Platform API Integration Tests', () => {
  let appServer: AppServer;
  const testPort = 3095;

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

  it('GET /api/system/platform - should return normalized platform detection metadata', async () => {
    const res = await request(appServer.app).get('/api/system/platform');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('platform');
    expect(res.body).toHaveProperty('os');
    expect(res.body).toHaveProperty('architecture');
    expect(res.body).toHaveProperty('supported', true);
  });

  it('POST /api/kill - should validate PID and reject system processes', async () => {
    const invalidRes = await request(appServer.app).post('/api/kill').send({ pid: 'invalid' });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error).toHaveProperty('code', 'INVALID_PID');

    const sysRes = await request(appServer.app).post('/api/kill').send({ pid: 1 });
    expect(sysRes.status).toBe(400);
    expect(sysRes.body.success).toBe(false);
  });

  it('POST /api/block-ip and /api/unblock-ip - should manage blocked IPs via platform firewall', async () => {
    const testIp = '198.51.100.99';
    const blockRes = await request(appServer.app).post('/api/block-ip').send({ ip: testIp, comment: 'Test block' });
    expect(blockRes.status).toBe(200);
    expect(blockRes.body.success).toBe(true);

    const listRes = await request(appServer.app).get('/api/blocked-ips');
    expect(listRes.status).toBe(200);
    expect(listRes.body.blockedIps.some((b: any) => b.ip === testIp)).toBe(true);

    const unblockRes = await request(appServer.app).post('/api/unblock-ip').send({ ip: testIp });
    expect(unblockRes.status).toBe(200);
    expect(unblockRes.body.success).toBe(true);
  });
});
