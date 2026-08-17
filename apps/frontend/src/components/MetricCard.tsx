import React, { ReactNode } from 'react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  footnote?: string;
  icon: ReactNode;
  accentColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  footnote,
  icon,
  accentColor = '#00f0ff',
}) => {
  return (
    <div className="glass-panel metric-card">
      <div
        className="metric-card-top-bar"
        style={{
          background: `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`,
        }}
      />
      <div className="metric-header">
        <span>{title}</span>
        <div
          className="metric-icon-wrap"
          style={{
            background: `${accentColor}18`,
            borderColor: `${accentColor}35`,
            color: accentColor,
          }}
        >
          {icon}
        </div>
      </div>
      <div className="metric-value font-mono">{value}</div>
      {footnote && <div className="metric-footnote">{footnote}</div>}
    </div>
  );
};
