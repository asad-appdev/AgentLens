import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('Security API Endpoints Integration', () => {
  let appServer: AppServer;

  const testConfig: ServerConfig = {
    host: '127.0.0.1',
    port: 3098,
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

  it('GET /api/security/alerts returns alerts list', async () => {
    const res = await request(appServer.app).get('/api/security/alerts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it('GET /api/security/incidents returns incidents list', async () => {
    const res = await request(appServer.app).get('/api/security/incidents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.incidents)).toBe(true);
  });

  it('GET /api/security/timeline returns filtered timeline events', async () => {
    const res = await request(appServer.app).get('/api/security/timeline');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('GET /api/security/sensitive-files returns sensitive access log', async () => {
    const res = await request(appServer.app).get('/api/security/sensitive-files');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.files)).toBe(true);
  });

  it('POST /api/security/sensitive-files records file access metadata and checks alerts', async () => {
    const res = await request(appServer.app)
      .post('/api/security/sensitive-files')
      .send({
        filePath: '/Users/developer/.ssh/id_rsa',
        accessedBy: 'claude-cli',
        pid: 9999,
        processName: 'claude',
      });
    expect(res.status).toBe(200);
    expect(res.body.recorded).toBe(true);
    expect(res.body.access.category).toBe('ssh');
  });

  it('GET /api/security/persistence returns persistence scanner items', async () => {
    const res = await request(appServer.app).get('/api/security/persistence');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /api/security/packages returns package activity log', async () => {
    const res = await request(appServer.app).get('/api/security/packages');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.events)).toBe(true);
  });

  it('GET /api/security/policies returns agent policies', async () => {
    const res = await request(appServer.app).get('/api/security/policies');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(Array.isArray(res.body.policies)).toBe(true);
  });

  it('POST and DELETE /api/security/trusted manages trusted entities', async () => {
    const postRes = await request(appServer.app)
      .post('/api/security/trusted')
      .send({
        type: 'domain',
        value: 'api.anthropic.com',
        reason: 'Official Claude endpoint',
      });
    expect(postRes.status).toBe(200);
    expect(postRes.body.success).toBe(true);
    const trustedId = postRes.body.record.id;

    const delRes = await request(appServer.app).delete(`/api/security/trusted/${trustedId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
  });

  it('POST /api/security/investigate executes evidence synthesis and recommendations', async () => {
    const res = await request(appServer.app)
      .post('/api/security/investigate')
      .send({
        targetId: 'claude-cli',
        question: 'Why was this process flagged?',
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('observedFacts');
    expect(res.body).toHaveProperty('inferences');
    expect(res.body).toHaveProperty('whatCannotBeConfirmed');
    expect(res.body).toHaveProperty('recommendedActions');
  });

  it('POST /api/security/clear-history clears local timeline and alerts', async () => {
    const res = await request(appServer.app).post('/api/security/clear-history');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
