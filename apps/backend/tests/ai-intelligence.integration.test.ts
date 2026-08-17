import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('AI Intelligence & Investigation API Integration Tests (Phase 11)', () => {
  let appServer: AppServer;
  const testPort = 3109;


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

  it('GET /api/ai-agents - should return list of AI agent profiles', async () => {
    const res = await request(appServer.app).get('/api/ai-agents');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('agents');
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents.length).toBeGreaterThanOrEqual(10);
  }, 15000);

  it('GET /api/ai-agents/ollama - should return Ollama profile', async () => {
    const res = await request(appServer.app).get('/api/ai-agents/ollama');
    expect(res.status).toBe(200);
    expect(res.body.agentId).toBe('ollama');
    expect(res.body.displayName).toBe('Ollama');
  }, 15000);

  it('GET /api/ai-agents/ollama/graph - should return relationship graph data', async () => {
    const res = await request(appServer.app).get('/api/ai-agents/ollama/graph');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('nodes');
    expect(res.body).toHaveProperty('edges');
  });

  it('GET /api/intelligence/baselines - should return historical baseline', async () => {
    const res = await request(appServer.app).get('/api/intelligence/baselines?entityId=ollama');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('typicalUploadRate');
    expect(res.body).toHaveProperty('typicalDownloadRate');
  });

  it('GET /api/intelligence/indicators - should return behavior indicators', async () => {
    const res = await request(appServer.app).get('/api/intelligence/indicators');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('indicators');
  }, 15000);


  it('GET /api/intelligence/suggestions - should return smart suggestions', async () => {
    const res = await request(appServer.app).get('/api/intelligence/suggestions');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('suggestions');
  });

  it('Investigation Workspace CRUD Flow', async () => {
    // 1. List
    const listRes = await request(appServer.app).get('/api/investigations');
    expect(listRes.status).toBe(200);

    // 2. Create
    const createRes = await request(appServer.app)
      .post('/api/investigations')
      .send({ title: 'Claude Code Investigation', description: 'Monitoring endpoints' });
    expect(createRes.status).toBe(201);
    const invId = createRes.body.id;

    // 3. Pin item
    const pinRes = await request(appServer.app)
      .post(`/api/investigations/${invId}/items`)
      .send({ type: 'agent', targetId: 'claude-code', title: 'Claude Code CLI' });
    expect(pinRes.status).toBe(201);

    // 4. Add note
    const noteRes = await request(appServer.app)
      .post(`/api/investigations/${invId}/notes`)
      .send({ text: 'Observed 3 remote connections to Anthropic API endpoints' });
    expect(noteRes.status).toBe(201);

    // 5. Export HTML
    const exportRes = await request(appServer.app).get(`/api/investigations/${invId}/export?format=html`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/html');
  });
});
