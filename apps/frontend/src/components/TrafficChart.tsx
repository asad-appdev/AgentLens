import React, { useState } from 'react';
import { TrafficTimelineBucket } from '@network-monitor/shared';
import { formatBytesPerSec } from '../utils/formatters.js';

export interface TrafficChartProps {
  timeline: TrafficTimelineBucket[];
  height?: number;
  isLive?: boolean;
}

export const TrafficChart: React.FC<TrafficChartProps> = ({
  timeline,
  height = 190,
  isLive = true,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!timeline || timeline.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          border: '1px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(0, 0, 0, 0.2)',
          gap: 8,
        }}
      >
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#00f0ff' }} className="status-dot active" />
        <span>Collecting real-time traffic history samples...</span>
      </div>
    );
  }

  const width = 720;
  const padding = { top: 24, right: 30, bottom: 32, left: 65 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find max rate across buckets (minimum 2 KB/s floor for aesthetic scale)
  const maxRate = Math.max(
    ...timeline.map((d) => Math.max(d.bytesInRate, d.bytesOutRate)),
    2048
  );

  const getX = (index: number) => {
    if (timeline.length <= 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (timeline.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return padding.top + chartHeight - (val / maxRate) * chartHeight;
  };

  // Generate Path for In (Download)
  const inPath = timeline
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.bytesInRate)}`)
    .join(' ');

  // Generate Path for Out (Upload)
  const outPath = timeline
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.bytesOutRate)}`)
    .join(' ');

  // Generate Area under Download line
  const inArea = `${inPath} L ${getX(timeline.length - 1)} ${padding.top + chartHeight} L ${getX(0)} ${padding.top + chartHeight} Z`;

  const hoveredBucket = hoverIndex !== null && timeline[hoverIndex] ? timeline[hoverIndex] : null;
  const latestBucket = timeline[timeline.length - 1];

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {/* Chart Top Legend & Real-Time Pulse */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          fontSize: '0.78rem',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600 }}>
            <span style={{ width: '10px', height: '3px', background: '#10b981', borderRadius: '2px', boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)' }} />
            Download (↓ {latestBucket ? formatBytesPerSec(latestBucket.bytesInRate) : '0 B/s'})
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#00f0ff', fontWeight: 600 }}>
            <span style={{ width: '10px', height: '3px', background: '#00f0ff', borderRadius: '2px', boxShadow: '0 0 8px rgba(0, 240, 255, 0.5)' }} />
            Upload (↑ {latestBucket ? formatBytesPerSec(latestBucket.bytesOutRate) : '0 B/s'})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isLive && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              <span className="status-dot active" style={{ width: 6, height: 6 }} />
              <span>STREAMING LIVE</span>
            </div>
          )}
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Peak: <strong style={{ color: '#f8fafc' }}>{formatBytesPerSec(maxRate)}</strong>
          </span>
        </div>
      </div>

      {/* SVG Chart Container */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'hidden' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="downloadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
              <stop offset="60%" stopColor="#10b981" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines & Y-axis labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = padding.top + chartHeight * (1 - pct);
            const rateVal = maxRate * pct;
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 10}
                  y={y + 3.5}
                  fill="var(--text-muted)"
                  fontSize="9.5"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                >
                  {formatBytesPerSec(rateVal)}
                </text>
              </g>
            );
          })}

          {/* Download Area & Path */}
          <path d={inArea} fill="url(#downloadGrad)" />
          <path
            d={inPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Upload Line */}
          <path
            d={outPath}
            fill="none"
            stroke="#00f0ff"
            strokeWidth="2"
            strokeDasharray="4 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Latest Live Pulse Node */}
          {timeline.length > 0 && latestBucket && (
            <g>
              <circle
                cx={getX(timeline.length - 1)}
                cy={getY(latestBucket.bytesInRate)}
                r={4}
                fill="#10b981"
                filter="url(#glow-cyan)"
              />
              <circle
                cx={getX(timeline.length - 1)}
                cy={getY(latestBucket.bytesOutRate)}
                r={3.5}
                fill="#00f0ff"
                filter="url(#glow-cyan)"
              />
            </g>
          )}

          {/* Hover Crosshair */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={padding.top + chartHeight}
                stroke="rgba(0, 240, 255, 0.6)"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(timeline[hoverIndex]!.bytesInRate)}
                r={4.5}
                fill="#10b981"
                stroke="#080c14"
                strokeWidth="2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(timeline[hoverIndex]!.bytesOutRate)}
                r={4.5}
                fill="#00f0ff"
                stroke="#080c14"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Interactive Mouse Hover Overlay Slices */}
          {timeline.map((_, i) => {
            const x = getX(i);
            const sliceWidth = chartWidth / (timeline.length - 1 || 1);
            return (
              <rect
                key={i}
                x={x - sliceWidth / 2}
                y={padding.top}
                width={sliceWidth}
                height={chartHeight}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onMouseEnter={() => setHoverIndex(i)}
              />
            );
          })}

          {/* Time X-axis labels */}
          {timeline.length > 1 && (
            <>
              <text
                x={padding.left}
                y={height - 8}
                fill="var(--text-muted)"
                fontSize="9.5"
                fontFamily="var(--font-mono)"
              >
                {new Date(timeline[0]!.timeEpochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </text>
              <text
                x={padding.left + chartWidth / 2}
                y={height - 8}
                fill="var(--text-muted)"
                fontSize="9.5"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
              >
                {new Date(timeline[Math.floor(timeline.length / 2)]!.timeEpochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </text>
              <text
                x={width - padding.right}
                y={height - 8}
                fill="#00f0ff"
                fontSize="9.5"
                textAnchor="end"
                fontFamily="var(--font-mono)"
                fontWeight="700"
              >
                {new Date(timeline[timeline.length - 1]!.timeEpochMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (NOW)
              </text>
            </>
          )}
        </svg>

        {/* Hover Tooltip Card */}
        {hoveredBucket && hoverIndex !== null && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: Math.min(Math.max(getX(hoverIndex) - 90, 20), width - 200),
              background: 'rgba(10, 15, 28, 0.94)',
              border: '1px solid rgba(0, 240, 255, 0.35)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: '0.78rem',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
              pointerEvents: 'none',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
              {new Date(hoveredBucket.timeEpochMs).toLocaleTimeString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: '#10b981' }}>↓ Download:</span>
              <strong className="font-mono" style={{ color: '#f8fafc' }}>
                {formatBytesPerSec(hoveredBucket.bytesInRate)}
              </strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: '#00f0ff' }}>↑ Upload:</span>
              <strong className="font-mono" style={{ color: '#f8fafc' }}>
                {formatBytesPerSec(hoveredBucket.bytesOutRate)}
              </strong>
            </div>
            {hoveredBucket.activeProcesses !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4, marginTop: 2 }}>
                <span style={{ color: 'var(--text-muted)' }}>Active Processes:</span>
                <span className="font-mono" style={{ color: '#c7d2fe' }}>
                  {hoveredBucket.activeProcesses}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
