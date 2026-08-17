import React from 'react';
import { PreparedAction } from '@network-monitor/shared';
import {
  X,
  ShieldAlert,
  FileSearch,
} from 'lucide-react';

export interface ActionConfirmationModalProps {
  action: PreparedAction | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (actionId: string) => Promise<any>;
}

export const ActionConfirmationModal: React.FC<ActionConfirmationModalProps> = ({
  action,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !action) return null;

  const isDestructive = action.actionType === 'PREPARE_BLOCK_IP' || action.actionType === 'PREPARE_KILL_PROCESS';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '24px',
          border: isDestructive ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(0, 240, 255, 0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isDestructive ? (
              <ShieldAlert size={22} color="#fb7185" />
            ) : (
              <FileSearch size={22} color="var(--accent-cyan)" />
            )}
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{action.title}</h3>
          </div>
          <button className="action-btn" onClick={onClose} style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Reason & Target */}
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
          {action.reason}
        </div>

        {/* Impact Warning Box */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            background: isDestructive ? 'rgba(244, 63, 94, 0.08)' : 'rgba(0, 240, 255, 0.08)',
            border: isDestructive ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(0, 240, 255, 0.3)',
            marginBottom: '18px',
            fontSize: '0.82rem',
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: isDestructive ? '#fb7185' : 'var(--accent-cyan)', display: 'block', marginBottom: '4px' }}>
            Action Impact Preview:
          </strong>
          {action.impactDescription}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button className="action-btn" onClick={onClose} style={{ fontSize: '0.82rem' }}>
            Cancel
          </button>
          <button
            className="action-btn active"
            onClick={async () => {
              await onConfirm(action.id);
              onClose();
            }}
            style={{
              fontSize: '0.82rem',
              background: isDestructive ? 'var(--accent-rose)' : undefined,
              borderColor: isDestructive ? 'var(--accent-rose)' : undefined,
            }}
          >
            {isDestructive ? 'Confirm & Apply' : 'Confirm Action'}
          </button>
        </div>
      </div>
    </div>
  );
};
