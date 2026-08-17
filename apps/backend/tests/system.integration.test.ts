import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('System & Diagnostics API Integration Tests (Phase 10)', () => {
  let appServer: AppServer;
  const testPort = 3102;


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

  it('GET /api/health - should return system health status', async () => {
    const res = await request(appServer.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('monitors');
    expect(res.body.monitors.backend).toBe('running');
  });

  it('GET /api/ready - should return readiness state', async () => {
    const res = await request(appServer.app).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  it('GET /api/diagnostics - should return sanitized diagnostic report', async () => {
    const res = await request(appServer.app).get('/api/diagnostics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('appVersion');
    expect(res.body).toHaveProperty('memoryUsageMb');
    expect(res.body).toHaveProperty('monitors');
  });

  it('GET /api/diagnostics/export - should export JSON diagnostic report', async () => {
    const res = await request(appServer.app).get('/api/diagnostics/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('POST /api/system/pause and POST /api/system/resume - should toggle pause', async () => {
    const pauseRes = await request(appServer.app).post('/api/system/pause');
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.isPaused).toBe(true);

    const resumeRes = await request(appServer.app).post('/api/system/resume');
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.isPaused).toBe(false);
  });

  it('GET /api/system/backup and POST /api/system/backup - should create and list backups', async () => {
    const createRes = await request(appServer.app).post('/api/system/backup');
    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.backup).toHaveProperty('id');

    const listRes = await request(appServer.app).get('/api/system/backup');
    expect(listRes.status).toBe(200);
    expect(listRes.body.backups.length).toBeGreaterThanOrEqual(1);
  });
});
