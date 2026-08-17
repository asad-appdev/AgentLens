import http from 'node:http';
import express, { Express } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { config, ServerConfig } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { NetworkMonitorWsServer } from './websocket/ws.server.js';
import { historyAggregationService } from './services/history-aggregation.service.js';
import { historyCleanupService } from './services/history-cleanup.service.js';
import { processSupervisor } from './services/process-supervisor.service.js';
import { databaseService } from './services/database.service.js';
import { logger } from './services/logger.service.js';

export class AppServer {
  public readonly app: Express;
  public readonly httpServer: http.Server;
  public readonly wsServer: NetworkMonitorWsServer;
  private readonly serverConfig: ServerConfig;

  constructor(serverConfig: ServerConfig = config) {
    this.serverConfig = serverConfig;
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.wsServer = new NetworkMonitorWsServer(this.serverConfig.wsHeartbeatIntervalMs);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupStaticFrontend();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Restrict CORS strictly to local loopback origins
    this.app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          const isLocalhost =
            origin.startsWith('http://localhost:') ||
            origin.startsWith('http://127.0.0.1:') ||
            origin.startsWith('https://localhost:');
          if (isLocalhost) {
            return callback(null, true);
          }
          return callback(new Error('CORS policy: Access denied to non-local origins.'));
        },
        credentials: true,
      })
    );

    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(requestLogger);
  }

  private setupRoutes(): void {
    this.app.use('/api', apiRouter);

    // 404 handler for undefined /api routes
    this.app.use('/api', (req, res) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`,
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupStaticFrontend(): void {
    const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
    const localDist = path.resolve(process.cwd(), 'dist/public');

    const publicPath = fs.existsSync(frontendDist)
      ? frontendDist
      : fs.existsSync(localDist)
      ? localDist
      : null;

    if (publicPath) {
      this.app.use(express.static(publicPath));
      this.app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
          return next();
        }
        res.sendFile(path.join(publicPath, 'index.html'));
      });
    } else {
      // 404 handler for undefined endpoints when dist not present
      this.app.use((req, res) => {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`,
          },
          timestamp: new Date().toISOString(),
        });
      });
    }
  }

  private setupWebSocket(): void {
    this.wsServer.attach(this.httpServer);
  }

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Starts listening strictly on 127.0.0.1 (or loopback configured host).
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { host, port } = this.serverConfig;

      this.httpServer.listen(port, host, () => {
        if (process.env.NODE_ENV !== 'test') {
          logger.info(`====================================================`);
          logger.info(`  macOS Real-Time Network Monitor Backend           `);
          logger.info(`  HTTP Server:      http://${host}:${port}/api/health`);
          logger.info(`  WebSocket Server: ws://${host}:${port}/ws          `);
          logger.info(`  Bound Exclusively To: ${host} (Loopback Only)     `);
          logger.info(`====================================================`);

          historyAggregationService.start();
          historyCleanupService.start();
        }
        resolve();
      });

      this.httpServer.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`Port ${port} is already in use by another local process.`);
        }
        reject(err);
      });
    });
  }

  /**
   * Graceful shutdown of HTTP, WebSocket, supervised child processes, and SQLite.
   */
  public async stop(): Promise<void> {
    logger.info('[AppServer] Performing graceful shutdown sequence...');

    // 1. Stop background aggregators
    historyAggregationService.stop();
    historyCleanupService.stop();

    // 2. Terminate child processes
    processSupervisor.terminateAll();

    // 3. Close WebSocket server
    await this.wsServer.close();

    // 4. Close SQLite
    databaseService.close();

    // 5. Close HTTP server
    return new Promise((resolve) => {
      if (this.httpServer.listening) {
        this.httpServer.close((_err) => {
          logger.info('[AppServer] HTTP server closed.');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
