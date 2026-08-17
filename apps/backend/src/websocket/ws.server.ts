import { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket, RawData } from 'ws';
import {
  formatWsMessage,
  createPongMessage,
  createConnectionUpdateMessage,
  createErrorMessage,
} from './protocol.js';

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
  id: string;
}

export class NetworkMonitorWsServer {
  private wss: WebSocketServer | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private clients = new Set<ExtWebSocket>();

  constructor(private readonly heartbeatIntervalMs: number = 15000) {}

  /**
   * Initializes the WebSocket server attached to an HTTP server.
   */
  public attach(server: HttpServer): WebSocketServer {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      clientTracking: true,
      maxPayload: 1024 * 1024, // 1MB maximum payload
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const client = ws as ExtWebSocket;
      client.isAlive = true;
      client.id = Math.random().toString(36).substring(2, 9);
      this.clients.add(client);

      if (process.env.NODE_ENV !== 'test') {
        console.log(`[WS] Client connected: ${client.id} from ${req.socket.remoteAddress}`);
      }

      // Handle native WS protocol pong frame
      client.on('pong', () => {
        client.isAlive = true;
      });

      // Handle incoming JSON messages
      client.on('message', (data: RawData) => {
        this.handleMessage(client, data);
      });

      client.on('close', () => {
        this.clients.delete(client);
        if (process.env.NODE_ENV !== 'test') {
          console.log(`[WS] Client disconnected: ${client.id}`);
        }
      });

      client.on('error', (err) => {
        console.error(`[WS] Client error (${client.id}):`, err.message);
        this.clients.delete(client);
      });

      // Send initial state message to newly connected client
      this.sendToClient(client, createConnectionUpdateMessage([]));
    });

    // Start background heartbeat
    this.startHeartbeat();

    return this.wss;
  }

  /**
   * Handles incoming client messages.
   */
  private handleMessage(client: ExtWebSocket, data: RawData): void {
    try {
      const messageStr = data.toString('utf-8');
      const parsed = JSON.parse(messageStr);

      if (parsed.type === 'ping') {
        const nonce = parsed.payload?.nonce || parsed.nonce;
        this.sendToClient(client, createPongMessage(nonce));
      } else {
        // Unknown message type
        if (process.env.NODE_ENV !== 'test') {
          console.log(`[WS] Received message of type '${parsed.type}' from ${client.id}`);
        }
      }
    } catch (err) {
      this.sendToClient(
        client,
        createErrorMessage('INVALID_MESSAGE', 'Failed to parse JSON WebSocket message')
      );
    }
  }

  /**
   * Sends a structured message to a specific client.
   */
  public sendToClient(client: ExtWebSocket, message: any): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(typeof message === 'string' ? message : formatWsMessage(message));
    }
  }

  /**
   * Broadcasts a message to all connected clients.
   */
  public broadcast(message: any): void {
    const serialized = typeof message === 'string' ? message : formatWsMessage(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
      }
    }
  }

  /**
   * Returns current active client count.
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Heartbeat mechanism to detect stale/dead connections.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        if (!client.isAlive) {
          client.terminate();
          this.clients.delete(client);
          continue;
        }
        client.isAlive = false;
        client.ping();
      }
    }, this.heartbeatIntervalMs);
  }

  /**
   * Shuts down the WebSocket server and clears intervals.
   */
  public close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
      for (const client of this.clients) {
        client.terminate();
      }
      this.clients.clear();

      if (this.wss) {
        this.wss.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
