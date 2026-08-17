import React from 'react';
import { NetworkRelationshipGraphData } from '@network-monitor/shared';
import { Share2, Bot, Cpu, Radio, Globe, Info } from 'lucide-react';


export interface NetworkRelationshipGraphProps {
  data: NetworkRelationshipGraphData | null;
  onSelectNode?: (nodeId: string, nodeType: string) => void;
}

export const NetworkRelationshipGraph: React.FC<NetworkRelationshipGraphProps> = ({
  data,
  onSelectNode,
}) => {
  // Empty state if insufficient relationships or nodes
  const hasRelationships = data && data.nodes && data.nodes.length > 1 && data.edges && data.edges.length > 0;

  if (!hasRelationships) {
    return (
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          background: 'rgba(10, 15, 28, 0.7)',
          border: '1px dashed var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.92rem' }}>
          <Share2 size={16} color="var(--accent-cyan)" />
          <span>Network Relationship Graph</span>
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 10px', lineHeight: 1.5 }}>
          No significant network relationships detected yet. Agent Lens is actively monitoring agent runtimes, child processes, and outbound sockets. As multi-node activity is observed, the topology tree (Agent → Process → Connection → Endpoint) will be rendered here.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-dim)' }}>
          <Info size={12} />
          <span>Real-time graph mapping active</span>
        </div>
      </div>
    );
  }

  // Layout calculations (Horizontal tree columns: 0=Agent, 1=Process, 2=Socket, 3=Endpoint)
  const colX: Record<string, number> = {
    agent: 60,
    process: 220,
    socket: 400,
    endpoint: 580,
  };

  const typeCounts: Record<string, number> = { agent: 0, process: 0, socket: 0, endpoint: 0 };
  const nodePositions = new Map<string, { x: number; y: number }>();

  data.nodes.forEach((node) => {
    const t = node.type;
    const count = typeCounts[t] || 0;
    typeCounts[t] = count + 1;
    const x = colX[t] || 60;
    const y = 45 + count * 50;
    nodePositions.set(node.id, { x, y });
  });

  const maxCount = Math.max(...Object.values(typeCounts), 1);
  const svgHeight = Math.max(220, 60 + maxCount * 50);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'agent':
        return '#00f0ff';
      case 'process':
        return '#38bdf8';
      case 'socket':
        return '#34d399';
      case 'endpoint':
        return '#c084fc';
      default:
        return '#94a3b8';
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'agent':
        return <Bot size={13} color="#000" />;
      case 'process':
        return <Cpu size={13} color="#000" />;
      case 'socket':
        return <Radio size={13} color="#000" />;
      case 'endpoint':
        return <Globe size={13} color="#000" />;
      default:
        return null;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '16px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Share2 size={16} color="var(--accent-cyan)" /> Network Relationship Graph
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00f0ff' }} /> AI Agent
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} /> Process
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }} /> Connection
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc' }} /> Endpoint
          </span>
        </div>
      </div>

      <svg width="100%" height={svgHeight} viewBox={`0 0 720 ${svgHeight}`} style={{ overflow: 'visible' }}>
        {/* Render Edges */}
        {data.edges.map((edge, idx) => {
          const fromPos = nodePositions.get(edge.source);
          const toPos = nodePositions.get(edge.target);
          if (!fromPos || !toPos) return null;

          const dx = toPos.x - fromPos.x;
          const curveX1 = fromPos.x + dx * 0.5;
          const curveX2 = fromPos.x + dx * 0.5;
          const path = `M ${fromPos.x + 14} ${fromPos.y} C ${curveX1} ${fromPos.y}, ${curveX2} ${toPos.y}, ${toPos.x - 14} ${toPos.y}`;

          return (
            <g key={idx}>
              <path
                d={path}
                fill="none"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth={1.5}
              />
              {edge.label && (
                <text
                  x={(fromPos.x + toPos.x) / 2}
                  y={(fromPos.y + toPos.y) / 2 - 4}
                  fill="var(--text-muted)"
                  fontSize="8.5"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Render Nodes */}
        {data.nodes.map((node) => {
          const pos = nodePositions.get(node.id);
          if (!pos) return null;
          const color = getNodeColor(node.type);

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              style={{ cursor: onSelectNode ? 'pointer' : 'default' }}
              onClick={() => onSelectNode && onSelectNode(node.id, node.type)}
            >
              <circle r={14} fill={color} opacity={0.2} />
              <circle r={11} fill={color} />
              <g transform="translate(-6.5, -6.5)">{getNodeIcon(node.type)}</g>
              <text
                x={18}
                y={3}
                fill="#f8fafc"
                fontSize="10.5"
                fontWeight="600"
                fontFamily="var(--font-sans)"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
