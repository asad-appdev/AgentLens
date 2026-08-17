import React, { useState } from 'react';
import {
  InvestigationWorkspace,
} from '@network-monitor/shared';
import {
  X,
  FileSearch,
  Plus,
  Trash2,
  Download,
  Pin,
  MessageSquare,
  Clock,
} from 'lucide-react';

export interface InvestigationWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  investigations: InvestigationWorkspace[];
  onCreateInvestigation: (title: string, desc?: string) => Promise<any>;
  onAddNote: (investigationId: string, text: string) => Promise<boolean>;
  onDeleteInvestigation: (id: string) => Promise<boolean>;
}

export const InvestigationWorkspaceModal: React.FC<InvestigationWorkspaceModalProps> = ({
  isOpen,
  onClose,
  investigations,
  onCreateInvestigation,
  onAddNote,
  onDeleteInvestigation,
}) => {
  const [selectedId, setSelectedId] = useState<string>(investigations[0]?.id || '');
  const [newTitle, setNewTitle] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const currentWorkspace = investigations.find((w) => w.id === selectedId) || investigations[0];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const ws = await onCreateInvestigation(newTitle.trim());
    if (ws) {
      setSelectedId(ws.id);
      setNewTitle('');
      setIsCreating(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !currentWorkspace) return;
    await onAddNote(currentWorkspace.id, newNote.trim());
    setNewNote('');
  };

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
        zIndex: 2000,
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '840px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          border: '1px solid rgba(0, 240, 255, 0.4)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSearch size={22} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Investigation Workspace</h3>
          </div>
          <button className="action-btn" onClick={onClose} style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Workspace Selector Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {investigations.map((w) => (
              <button
                key={w.id}
                className={`action-btn ${w.id === (currentWorkspace?.id || '') ? 'active' : ''}`}
                onClick={() => setSelectedId(w.id)}
                style={{ fontSize: '0.78rem', padding: '4px 12px' }}
              >
                {w.title} ({w.items.length})
              </button>
            ))}
          </div>

          <button
            className="action-btn"
            onClick={() => setIsCreating(true)}
            style={{ fontSize: '0.75rem', gap: '4px' }}
          >
            <Plus size={13} /> New Investigation
          </button>
        </div>

        {/* Create Investigation Form */}
        {isCreating && (
          <form onSubmit={handleCreate} className="glass-panel" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="search-input"
              style={{ flex: 1, padding: '4px 10px', fontSize: '0.85rem' }}
              placeholder="e.g. Claude Code High Throughput Investigation..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button type="submit" className="action-btn active" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
              Create
            </button>
            <button type="button" className="action-btn" onClick={() => setIsCreating(false)} style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
              Cancel
            </button>
          </form>
        )}

        {currentWorkspace && (
          <div>
            {/* Title & Description */}
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{currentWorkspace.title}</h4>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{currentWorkspace.description || 'Local investigation workspace.'}</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <a
                  href={`/api/investigations/${currentWorkspace.id}/export?format=html`}
                  download
                  className="action-btn"
                  style={{ fontSize: '0.74rem', gap: '4px', textDecoration: 'none' }}
                >
                  <Download size={12} /> Export HTML
                </a>
                <a
                  href={`/api/investigations/${currentWorkspace.id}/export?format=json`}
                  download
                  className="action-btn"
                  style={{ fontSize: '0.74rem', gap: '4px', textDecoration: 'none' }}
                >
                  <Download size={12} /> JSON
                </a>
                <button
                  className="action-btn"
                  onClick={() => onDeleteInvestigation(currentWorkspace.id)}
                  style={{ fontSize: '0.74rem', color: 'var(--accent-rose)', padding: '4px 8px' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Pinned Items */}
            <div className="glass-panel" style={{ padding: '14px', marginBottom: '16px' }}>
              <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Pin size={14} color="var(--accent-cyan)" /> Pinned Observability Targets ({currentWorkspace.items.length})
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {currentWorkspace.items.length > 0 ? (
                  currentWorkspace.items.map((item) => (
                    <div key={item.id} className="pill-tag" style={{ fontSize: '0.76rem', gap: '6px' }}>
                      <strong style={{ color: 'var(--accent-cyan)' }}>[{item.type.toUpperCase()}]</strong>
                      <span>{item.title}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    No items pinned. Pin processes, AI agents, or endpoints from any inspector modal.
                  </div>
                )}
              </div>
            </div>

            {/* Investigation Notes & Timeline */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Notes */}
              <div className="glass-panel" style={{ padding: '14px' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={14} color="var(--accent-emerald)" /> Local Notes ({currentWorkspace.notes.length})
                </div>
                <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  <input
                    type="text"
                    className="search-input"
                    style={{ flex: 1, padding: '3px 8px', fontSize: '0.78rem' }}
                    placeholder="+ Add investigation note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <button type="submit" className="action-btn" style={{ padding: '3px 8px', fontSize: '0.74rem' }}>
                    Add
                  </button>
                </form>
                <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {currentWorkspace.notes.map((note) => (
                    <div key={note.id} style={{ fontSize: '0.78rem', padding: '6px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)' }}>
                      <div>{note.text}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{new Date(note.timestamp).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="glass-panel" style={{ padding: '14px' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="#fbbf24" /> Unified Investigation Timeline
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {currentWorkspace.timeline.map((evt, idx) => (
                    <div key={idx} style={{ fontSize: '0.76rem', borderLeft: '2px solid var(--accent-cyan)', paddingLeft: '8px' }}>
                      <div style={{ color: 'var(--text-secondary)' }}>{evt.description}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{new Date(evt.timestamp).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
