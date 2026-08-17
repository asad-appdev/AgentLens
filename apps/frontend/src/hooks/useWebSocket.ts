import { useState, useEffect, useRef, useCallback } from 'react';
import {
  WebSocketServerMessage,
  WebSocketClientMessage,
  NetworkConnection,
} from '@network-monitor/shared';

export type WsConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface UseWebSocketReturn {
  status: WsConnectionStatus;
  connections: NetworkConnection[];
  totalConnections: number;
  latencyMs: number | null;
  lastMessageTime: number | null;
  sendMessage: (msg: WebSocketClientMessage) => void;
  sendPing: () => void;
  reconnect: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<WsConnectionStatus>('connecting');
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [totalConnections, setTotalConnections] = useState<number>(0);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<number | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingStartRef = useRef<number | null>(null);

  const getWsUrl = (): string => {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // In dev mode with Vite proxy, loc.host points to Vite dev server which proxies /ws
    return `${protocol}//${loc.host}/ws`;
  };

  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      setStatus('connecting');
      const wsUrl = getWsUrl();
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        // Initial ping to measure roundtrip latency
        pingStartRef.current = performance.now();
        ws.send(JSON.stringify({ type: 'ping', payload: { nonce: 'init' }, timestamp: Date.now() }));
      };

      ws.onmessage = (event) => {
        setLastMessageTime(Date.now());
        try {
          const msg = JSON.parse(event.data) as WebSocketServerMessage;

          if (msg.type === 'pong') {
            if (pingStartRef.current !== null) {
              const latency = Math.round(performance.now() - pingStartRef.current);
              setLatencyMs(latency);
              pingStartRef.current = null;
            }
          } else if (msg.type === 'connection_update') {
            if (msg.payload && Array.isArray(msg.payload.connections)) {
              setConnections(msg.payload.connections);
              setTotalConnections(msg.payload.totalCount ?? msg.payload.connections.length);
            }
          }
        } catch (err) {
          console.error('Failed to parse incoming WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        setStatus('disconnected');
        // Automatic reconnection attempt after 2.5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2500);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket encountered an error:', err);
        ws.close();
      };
    } catch (err) {
      console.error('Failed to create WebSocket instance:', err);
      setStatus('disconnected');
    }
  }, []);

  const sendMessage = useCallback((msg: WebSocketClientMessage) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendPing = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      pingStartRef.current = performance.now();
      sendMessage({
        type: 'ping',
        payload: { nonce: Math.random().toString(36).substring(7) },
        timestamp: Date.now(),
      });
    }
  }, [sendMessage]);

  useEffect(() => {
    connect();

    // Periodic ping every 10 seconds to keep connection alive and update latency
    const pingInterval = setInterval(() => {
      sendPing();
    }, 10000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect, sendPing]);

  return {
    status,
    connections,
    totalConnections,
    latencyMs,
    lastMessageTime,
    sendMessage,
    sendPing,
    reconnect: connect,
  };
}
