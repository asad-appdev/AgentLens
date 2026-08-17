import { describe, it, expect } from 'vitest';
import { LocalServersService } from '../src/services/local-servers.service.js';

describe('LocalServersService Unit Tests', () => {
  const service = new LocalServersService();

  describe('Server Classification & Detection', () => {
    it('should classify Vite development server from command line', () => {
      // @ts-expect-error private method testing
      const result = service.classifyServerType('node', 'node /Users/project/node_modules/.bin/vite --port 5174', 5174);
      expect(result.serverType).toBe('Vite');
      expect(result.isDevServer).toBe(true);
      expect(result.confidence).toBe('HIGH');
    });

    it('should classify Next.js development server', () => {
      // @ts-expect-error private method testing
      const result = service.classifyServerType('node', 'next-server (v16.3.0) dev', 3000);
      expect(result.serverType).toBe('Next.js');
      expect(result.isDevServer).toBe(true);
    });

    it('should classify Python FastAPI with Uvicorn', () => {
      // @ts-expect-error private method testing
      const result = service.classifyServerType('python3', 'python3 -m uvicorn main:app --reload', 8000);
      expect(result.serverType).toBe('Python / FastAPI');
      expect(result.isDevServer).toBe(true);
    });

    it('should classify Django development server', () => {
      // @ts-expect-error private method testing
      const result = service.classifyServerType('python', 'python manage.py runserver 0.0.0.0:8000', 8000);
      expect(result.serverType).toBe('Python / Django');
      expect(result.isDevServer).toBe(true);
    });

    it('should classify PostgreSQL and Redis database servers as infrastructure (not dev server)', () => {
      // @ts-expect-error private method testing
      const pg = service.classifyServerType('postgres', '/opt/homebrew/bin/postgres', 5432);
      expect(pg.serverType).toBe('PostgreSQL');
      expect(pg.isDevServer).toBe(false);

      // @ts-expect-error private method testing
      const redis = service.classifyServerType('redis-server', '/opt/homebrew/bin/redis-server *:6379', 6379);
      expect(redis.serverType).toBe('Redis');
      expect(redis.isDevServer).toBe(false);
    });

    it('should classify Ollama as local AI runtime', () => {
      // @ts-expect-error private method testing
      const ollama = service.classifyServerType('ollama', 'ollama serve', 11434);
      expect(ollama.serverType).toBe('Ollama');
      expect(ollama.isDevServer).toBe(false);
    });
  });

  describe('Discovery and Safety Checks', () => {
    it('should discover local listening servers without crashing', async () => {
      const servers = await service.discoverLocalServers();
      expect(Array.isArray(servers)).toBe(true);
      for (const s of servers) {
        expect(s.port).toBeGreaterThan(0);
        expect(s.pid).toBeGreaterThan(0);
        expect(s.state).toBe('LISTEN');
        expect(s.serverType).toBeDefined();
      }
    });

    it('should return failure if attempting to kill an inactive port', async () => {
      // Non-existent port 59999
      const result = await service.killPort({ port: 59999 });
      expect(result.port).toBe(59999);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No active listening process');
    });
  });
});
