import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('Automation & Prepared Actions API Integration Tests (Phase 13)', () => {
  let appServer: AppServer;
  const testPort = 3098;

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

  it('GET /api/automation/actions - should list prepared actions', async () => {
    const res = await request(appServer.app).get('/api/automation/actions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('actions');
  });

  it('POST /api/automation/nl-filter - should parse natural language query into structured filter', async () => {
    const res = await request(appServer.app)
      .post('/api/automation/nl-filter')
      .send({ query: 'Show connections from AI agents using more than 1 MB/s' });

    expect(res.status).toBe(200);
    expect(res.body.isAiOnly).toBe(true);
    expect(res.body.minThroughputBytesPerSec).toBe(1048576);
  });

  it('Watch Rules API Flow - list, create, delete', async () => {
    // 1. List
    const listRes = await request(appServer.app).get('/api/automation/watch-rules');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveProperty('rules');

    // 2. Create
    const createRes = await request(appServer.app)
      .post('/api/automation/watch-rules')
      .send({
        name: 'Ollama High Traffic Watch',
        targetType: 'agent',
        targetName: 'Ollama',
        triggerType: 'HIGH_THROUGHPUT',
        threshold: 5242880,
        action: 'NOTIFY',
      });
    expect(createRes.status).toBe(201);
    const ruleId = createRes.body.id;

    // 3. Delete
    const deleteRes = await request(appServer.app).delete(`/api/automation/watch-rules/${ruleId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
  });
});
