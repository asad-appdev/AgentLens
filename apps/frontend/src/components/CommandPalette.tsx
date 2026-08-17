import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Layers,
  Activity,
  Shield,
  History,
  Settings,
  Download,
  Zap,
  Bot,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { NetworkConnection } from '@network-monitor/shared';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  connections: NetworkConnection[];
  onSelectTab: (tab: 'CONNECTIONS' | 'TRAFFIC' | 'FIREWALL' | 'HISTORY' | 'SETTINGS') => void;
  onOpenExport: () => void;
  onInspectProcess: (pid: number) => void;
  onToggleCompact: () => void;
  isCompact: boolean;
  onToggleFocus: () => void;
  isFocus: boolean;
  onSendPing: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  connections,
  onSelectTab,
  onOpenExport,
  onInspectProcess,
  onToggleCompact,
  isCompact,
  onToggleFocus,
  isFocus,
  onSendPing,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Extract unique active processes
  const uniqueProcesses = Array.from(
    new Map(connections.map((c) => [c.pid, { pid: c.pid, name: c.processName, isAi: c.isAiAgent }])).values()
  );

  // Define static commands
  const staticCommands = [
    {
      id: 'tab-connections',
      title: 'Go to Sockets & Connections',
      icon: <Layers size={15} />,
      action: () => { onSelectTab('CONNECTIONS'); onClose(); },
    },
    {
      id: 'tab-traffic',
      title: 'Go to Live Process Traffic',
      icon: <Activity size={15} />,
      action: () => { onSelectTab('TRAFFIC'); onClose(); },
    },
    {
      id: 'tab-firewall',
      title: 'Go to Blocked IPs & Firewall',
      icon: <Shield size={15} />,
      action: () => { onSelectTab('FIREWALL'); onClose(); },
    },
    {
      id: 'tab-history',
      title: 'Go to History & Analytics',
      icon: <History size={15} />,
      action: () => { onSelectTab('HISTORY'); onClose(); },
    },
    {
      id: 'tab-settings',
      title: 'Open Settings & Privacy',
      icon: <Settings size={15} />,
      action: () => { onSelectTab('SETTINGS'); onClose(); },
    },
    {
      id: 'action-export',
      title: 'Export Network Snapshot or History (CSV / JSON)',
      icon: <Download size={15} />,
      action: () => { onClose(); onOpenExport(); },
    },
    {
      id: 'action-compact',
      title: isCompact ? 'Disable Compact Mode' : 'Enable High-Density Compact Mode',
      icon: isCompact ? <Minimize2 size={15} /> : <Maximize2 size={15} />,
      action: () => { onToggleCompact(); onClose(); },
    },
    {
      id: 'action-focus',
      title: isFocus ? 'Exit Focus Mode' : 'Enter Distraction-Free Focus Mode',
      icon: <Maximize2 size={15} />,
      action: () => { onToggleFocus(); onClose(); },
    },
    {
      id: 'action-ping',
      title: 'Send WebSocket Diagnostic Ping',
      icon: <Zap size={15} />,
      action: () => { onSendPing(); onClose(); },
    },
  ];

  // Filter commands and processes based on query
  const q = query.toLowerCase().trim();
  const matchedCommands = staticCommands.filter((c) => c.title.toLowerCase().includes(q));

  const matchedProcesses = uniqueProcesses
    .filter((p) => p.name.toLowerCase().includes(q) || p.pid.toString().includes(q))
    .slice(0, 5)
    .map((p) => ({
      id: `proc-${p.pid}`,
      title: `Inspect Process: ${p.name} (PID ${p.pid})`,
      icon: p.isAi ? <Bot size={15} color="#34d399" /> : <Activity size={15} />,
      action: () => { onClose(); onInspectProcess(p.pid); },
    }));

  const allItems = [...matchedCommands, ...matchedProcesses];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(allItems.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(allItems.length, 1));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      allItems[selectedIndex]!.action();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 2000,
        paddingTop: '15vh',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '0',
          overflow: 'hidden',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', gap: '10px' }}>
          <Search size={18} color="var(--accent-cyan)" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: '1rem',
              outline: 'none',
            }}
            placeholder="Type a command or search process / PID..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <span className="badge badge-neutral" style={{ fontSize: '0.68rem' }}>ESC to close</span>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '8px' }}>
          {allItems.length > 0 ? (
            allItems.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  background: idx === selectedIndex ? 'rgba(0, 240, 255, 0.12)' : 'transparent',
                  color: idx === selectedIndex ? 'var(--accent-cyan)' : 'var(--text-primary)',
                }}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ display: 'flex', color: idx === selectedIndex ? 'var(--accent-cyan)' : 'var(--text-secondary)' }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1 }}>{item.title}</div>
              </div>
            ))
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No commands or processes matching &quot;{query}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
