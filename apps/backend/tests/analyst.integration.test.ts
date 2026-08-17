import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('Local AI Analyst API Integration Tests (Phase 12)', () => {
  let appServer: AppServer;
  const testPort = 3097;

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

  it('POST /api/analyst/query - should answer questions about bandwidth', async () => {
    const res = await request(appServer.app)
      .post('/api/analyst/query')
      .send({ query: 'What is using the most bandwidth right now?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reply');
    expect(res.body.reply).toHaveProperty('text');
    expect(res.body.reply.sender).toBe('assistant');
  }, 15000);

  it('POST /api/analyst/query - should answer questions about AI agents', async () => {
    const res = await request(appServer.app)
      .post('/api/analyst/query')
      .send({ query: 'Which AI agents are currently active?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reply');
    expect(res.body.reply.text).toBeDefined();
  }, 15000);


  it('GET /api/analyst/config and PUT /api/analyst/config - should get and update config', async () => {
    const getRes = await request(appServer.app).get('/api/analyst/config');
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveProperty('provider');

    const putRes = await request(appServer.app)
      .put('/api/analyst/config')
      .send({ provider: 'fallback', ollamaModel: 'llama3.2:latest' });

    expect(putRes.status).toBe(200);
    expect(putRes.body.provider).toBe('fallback');
    expect(putRes.body.ollamaModel).toBe('llama3.2:latest');
  });

  it('GET /api/analyst/models - should return probe models array', async () => {
    const res = await request(appServer.app).get('/api/analyst/models');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('models');
    expect(Array.isArray(res.body.models)).toBe(true);
  });
});
