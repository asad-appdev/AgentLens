import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { AppServer } from '../src/server.js';
import { ServerConfig } from '../src/config/env.js';

describe('WebSocket Server', () => {
  let appServer: AppServer;
  const testPort = 3098;

  const testConfig: ServerConfig = {
    host: '127.0.0.1',
    port: testPort,
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

  it('should successfully establish WebSocket connection and receive initial connection_update', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${testPort}/ws`);

    const initialMessagePromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WS timeout')), 3000);
      ws.on('message', (data) => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString('utf-8')));
      });
      ws.on('error', reject);
    });

    const msg = await initialMessagePromise;
    expect(msg.type).toBe('connection_update');
    expect(msg.payload).toHaveProperty('connections');
    expect(Array.isArray(msg.payload.connections)).toBe(true);

    ws.close();
  });

  it('should respond with pong when receiving ping message', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${testPort}/ws`);

    await new Promise<void>((resolve) => ws.on('open', () => resolve()));

    const pongPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Pong timeout')), 3000);
      ws.on('message', (data) => {
        const parsed = JSON.parse(data.toString('utf-8'));
        if (parsed.type === 'pong') {
          clearTimeout(timeout);
          resolve(parsed);
        }
      });
      ws.on('error', reject);
    });

    ws.send(JSON.stringify({ type: 'ping', payload: { nonce: 'test-123' } }));

    const response = await pongPromise;
    expect(response.type).toBe('pong');
    expect(response.payload.nonce).toBe('test-123');

    ws.close();
  });
});
