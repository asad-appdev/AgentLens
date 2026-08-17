import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('Intelligence & Settings API Integration Tests (Phase 9)', () => {
  let appServer: AppServer;
  const testPort = 3101;


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

  it('GET /api/intelligence/settings - should return user settings', async () => {
    const res = await request(appServer.app).get('/api/intelligence/settings');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('connectionPollingIntervalMs');
    expect(res.body).toHaveProperty('notificationRules');
  });

  it('PUT /api/intelligence/settings - should update user settings', async () => {
    const res = await request(appServer.app)
      .put('/api/intelligence/settings')
      .send({ highTrafficAlertThresholdMbps: 15 });
    expect(res.status).toBe(200);
    expect(res.body.highTrafficAlertThresholdMbps).toBe(15);
  });

  it('POST /api/intelligence/favorite - should toggle favorite status', async () => {
    const res = await request(appServer.app)
      .post('/api/intelligence/favorite')
      .send({ pid: 4218, processName: 'ollama' });
    expect(res.status).toBe(200);
    expect(typeof res.body.isFavorite).toBe('boolean');
  });

  it('POST /api/intelligence/label - should set process custom label', async () => {
    const res = await request(appServer.app)
      .post('/api/intelligence/label')
      .send({ key: 'ollama', label: 'Local Ollama Service' });
    expect(res.status).toBe(200);
    expect(res.body.label).toBe('Local Ollama Service');
  });

  it('POST /api/intelligence/tags - should set process tags', async () => {
    const res = await request(appServer.app)
      .post('/api/intelligence/tags')
      .send({ key: 'ollama', tags: ['AI', 'Development'] });
    expect(res.status).toBe(200);
    expect(res.body.tags).toEqual(['AI', 'Development']);
  });

  it('GET /api/intelligence/events - should return notification events', async () => {
    const res = await request(appServer.app).get('/api/intelligence/events');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('events');
    expect(res.body).toHaveProperty('unreadCount');
  });

  it('GET /api/intelligence/process-tree - should return process relationship tree', async () => {
    const res = await request(appServer.app).get('/api/intelligence/process-tree');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tree');
    expect(Array.isArray(res.body.tree)).toBe(true);
  }, 15000);

});
