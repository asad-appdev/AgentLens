import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('History & Export API Integration Tests (Phase 8)', () => {
  let appServer: AppServer;
  const testPort = 3096;

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

  it('GET /api/history/status - should report database storage status', async () => {
    const res = await request(appServer.app).get('/api/history/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isAvailable', true);
    expect(res.body).toHaveProperty('isRecording', true);
    expect(res.body).toHaveProperty('databaseSizeBytes');
  });

  it('GET /api/history/summary - should return analytics summary', async () => {
    const res = await request(appServer.app).get('/api/history/summary?range=1h');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('from');
    expect(res.body).toHaveProperty('to');
    expect(res.body).toHaveProperty('totalDownloaded');
    expect(res.body).toHaveProperty('topProcesses');
  });

  it('GET /api/history/timeline - should return time-series buckets', async () => {
    const res = await request(appServer.app).get('/api/history/timeline?range=1h&buckets=10');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timeline');
    expect(Array.isArray(res.body.timeline)).toBe(true);
  });

  it('GET /api/history/connections - should return paginated connection history', async () => {
    const res = await request(appServer.app).get('/api/history/connections?limit=50');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('records');
    expect(res.body).toHaveProperty('total');
  });

  it('POST /api/history/toggle-recording - should toggle history recording', async () => {
    const resOff = await request(appServer.app)
      .post('/api/history/toggle-recording')
      .send({ enabled: false });
    expect(resOff.status).toBe(200);
    expect(resOff.body.isRecording).toBe(false);

    const resOn = await request(appServer.app)
      .post('/api/history/toggle-recording')
      .send({ enabled: true });
    expect(resOn.status).toBe(200);
    expect(resOn.body.isRecording).toBe(true);
  });

  it('GET /api/export/snapshot - should download live state snapshot JSON', async () => {
    const res = await request(appServer.app).get('/api/export/snapshot');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toHaveProperty('version', 1);
    expect(res.body).toHaveProperty('connections');
    expect(res.body).toHaveProperty('processes');
  });

  it('GET /api/export/history?format=csv - should download connections CSV', async () => {
    const res = await request(appServer.app).get('/api/export/history?format=csv&type=connections');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('timestamp,pid,process_name');
  });

  it('GET /api/export/history?format=json - should download history JSON', async () => {
    const res = await request(appServer.app).get('/api/export/history?format=json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toHaveProperty('schemaVersion', '1.0.0');
  });
});
