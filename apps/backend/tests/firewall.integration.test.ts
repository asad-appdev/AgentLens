import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('Firewall API Integration Tests (Phase 7)', () => {
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

  it('POST /api/firewall/block-ip - should block a valid IP', async () => {
    const res = await request(appServer.app)
      .post('/api/firewall/block-ip')
      .send({ ip: '142.250.72.14', comment: 'Google IP block test' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('ip', '142.250.72.14');
    expect(res.body.data).toHaveProperty('family', 'IPv4');
  });

  it('POST /api/firewall/block-ip - should reject duplicate IP block', async () => {
    const res = await request(appServer.app)
      .post('/api/firewall/block-ip')
      .send({ ip: '142.250.72.14' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('IP_ALREADY_BLOCKED');
  });

  it('POST /api/firewall/block-ip - should reject protected loopback IP', async () => {
    const res = await request(appServer.app)
      .post('/api/firewall/block-ip')
      .send({ ip: '127.0.0.1' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PROTECTED_IP');
  });

  it('GET /api/firewall/blocked-ips - should list all blocked IPs', async () => {
    const res = await request(appServer.app).get('/api/firewall/blocked-ips');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('blockedIps');
    expect(res.body.total).toBeGreaterThanOrEqual(1);
    expect(res.body.blockedIps.some((item: any) => item.ip === '142.250.72.14')).toBe(true);
  });

  it('POST /api/firewall/unblock-ip - should unblock an existing blocked IP', async () => {
    const res = await request(appServer.app)
      .post('/api/firewall/unblock-ip')
      .send({ ip: '142.250.72.14' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('unblockedIp', '142.250.72.14');
  });

  it('POST /api/firewall/unblock-ip - should return 404 for unblocking non-blocked IP', async () => {
    const res = await request(appServer.app)
      .post('/api/firewall/unblock-ip')
      .send({ ip: '142.250.72.14' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BLOCK_NOT_FOUND');
  });

  it('GET /api/firewall/events - should return audit event history', async () => {
    const res = await request(appServer.app).get('/api/firewall/events');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('events');
    expect(res.body.events.length).toBeGreaterThanOrEqual(2);
  });
});
