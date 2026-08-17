import React from 'react';

export interface StatusBadgeProps {
  label: string;
  state: 'connected' | 'connecting' | 'disconnected' | 'healthy' | 'unhealthy' | 'neutral';
  subText?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, state, subText }) => {
  let badgeClass = 'badge-neutral';
  let dotClass = 'active';

  switch (state) {
    case 'connected':
    case 'healthy':
      badgeClass = 'badge-connected';
      dotClass = 'active';
      break;
    case 'connecting':
      badgeClass = 'badge-connecting';
      dotClass = 'warning';
      break;
    case 'disconnected':
    case 'unhealthy':
      badgeClass = 'badge-disconnected';
      dotClass = 'danger';
      break;
    default:
      badgeClass = 'badge-neutral';
      dotClass = '';
  }

  return (
    <div className={`badge ${badgeClass}`}>
      <span className={`status-dot ${dotClass}`} />
      <span>{label}</span>
      {subText && <span style={{ opacity: 0.75, fontSize: '0.72rem' }}>({subText})</span>}
    </div>
  );
};
