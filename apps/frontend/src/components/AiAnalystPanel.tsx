import React, { useState, useRef, useEffect } from 'react';
import {
  AnalystMessage,
  AnalystConfig,
  OllamaModelInfo,
} from '@network-monitor/shared';
import {
  Send,
  Bot,
  Settings,
  Sparkles,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

export interface AiAnalystPanelProps {
  messages: AnalystMessage[];
  isLoading: boolean;
  config: AnalystConfig | null;
  availableModels: OllamaModelInfo[];
  onSendMessage: (query: string) => Promise<any>;
  onUpdateConfig: (cfg: Partial<AnalystConfig>) => Promise<boolean>;
  onActionClick?: (actionType: string, target: string) => void;
}

const PRESET_PROMPTS = [
  'What is using the most bandwidth right now?',
  'Which AI agents are currently active?',
  'Why did traffic suddenly increase?',
  'Show me everything Ollama connected to today.',
  'What changed in the last 30 minutes?',
];

export const AiAnalystPanel: React.FC<AiAnalystPanelProps> = ({
  messages,
  isLoading,
  config,
  availableModels,
  onSendMessage,
  onUpdateConfig,
  onActionClick,
}) => {
  const [inputQuery, setInputQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AnalystConfig['provider']>(config?.provider || 'ollama');
  const [ollamaEndpoint, setOllamaEndpoint] = useState(config?.ollamaEndpoint || 'http://127.0.0.1:11434');
  const [ollamaModel, setOllamaModel] = useState(config?.ollamaModel || 'llama3.2:latest');
  const [openaiKey, setOpenaiKey] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (config) {
      setSelectedProvider(config.provider);
      setOllamaEndpoint(config.ollamaEndpoint);
      setOllamaModel(config.ollamaModel);
    }
  }, [config]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isLoading) return;
    const text = inputQuery.trim();
    setInputQuery('');
    await onSendMessage(text);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateConfig({
      provider: selectedProvider,
      ollamaEndpoint,
      ollamaModel,
      openaiApiKey: openaiKey || undefined,
    });
    setShowSettings(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: 'calc(100vh - 230px)', minHeight: '520px' }}>
      {/* Top Bar with Provider Status & Settings Toggle */}
      <div className="glass-panel" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(0, 240, 255, 0.1)' }}>
            <Bot size={20} color="var(--accent-cyan)" />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Local AI Network Analyst</span>
              <span className="badge badge-neutral" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                {config?.provider === 'disabled' ? 'Disabled' : config?.provider || 'Ollama'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              100% on-device local reasoning &bull; Zero shell execution permissions &bull; Read-only monitoring
            </div>
          </div>
        </div>

        <button
          className={`action-btn ${showSettings ? 'active' : ''}`}
          onClick={() => setShowSettings(!showSettings)}
          style={{ fontSize: '0.78rem', gap: '6px' }}
        >
          <Settings size={14} />
          <span>LLM Provider Settings</span>
        </button>
      </div>

      {/* Settings Popover Drawer */}
      {showSettings && (
        <form onSubmit={handleSaveSettings} className="glass-panel" style={{ padding: '16px', border: '1px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '12px' }}>AI Analyst Engine Configuration</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>LLM Provider</label>
              <select
                className="search-input"
                style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem' }}
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as any)}
              >
                <option value="ollama">Ollama (Localhost - Recommended)</option>
                <option value="fallback">Local Rule-Based Analyst (Offline)</option>
                <option value="openai">OpenAI API (Cloud)</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            {selectedProvider === 'ollama' && (
              <>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Ollama Endpoint</label>
                  <input
                    type="text"
                    className="search-input"
                    style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem' }}
                    value={ollamaEndpoint}
                    onChange={(e) => setOllamaEndpoint(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Ollama Model</label>
                  {availableModels.length > 0 ? (
                    <select
                      className="search-input"
                      style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem' }}
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                    >
                      {availableModels.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem' }}
                      value={ollamaModel}
                      placeholder="llama3.2:latest or qwen2.5:latest"
                      onChange={(e) => setOllamaModel(e.target.value)}
                    />
                  )}
                </div>
              </>
            )}

            {selectedProvider === 'openai' && (
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>OpenAI API Key (sk-...)</label>
                <input
                  type="password"
                  className="search-input"
                  style={{ width: '100%', padding: '4px 8px', fontSize: '0.82rem' }}
                  value={openaiKey}
                  placeholder="Paste your OpenAI API key"
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" className="action-btn" onClick={() => setShowSettings(false)} style={{ fontSize: '0.78rem' }}>
              Cancel
            </button>
            <button type="submit" className="action-btn active" style={{ fontSize: '0.78rem' }}>
              Save Configuration
            </button>
          </div>
        </form>
      )}

      {/* Main Chat Feed */}
      <div
        className="glass-panel"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: isUser ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  border: isUser ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.text}
              </div>

              {/* Model Tag & Timestamp */}
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                {msg.modelUsed && <span style={{ color: 'var(--accent-cyan)' }}>&bull; {msg.modelUsed}</span>}
              </div>

              {/* Action Suggestion Chips */}
              {!isUser && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {msg.suggestedActions.map((act, idx) => (
                    <button
                      key={idx}
                      className="action-btn"
                      onClick={() => onActionClick && onActionClick(act.actionType, act.target)}
                      style={{
                        fontSize: '0.72rem',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        background: 'rgba(0, 240, 255, 0.08)',
                        borderColor: 'rgba(0, 240, 255, 0.3)',
                        color: 'var(--accent-cyan)',
                        gap: '4px',
                      }}
                    >
                      <span>{act.label}</span>
                      <ChevronRight size={11} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={13} className="spin" />
            <span>Analyzing local network telemetry...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Preset Quick Prompts */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        {PRESET_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            className="action-btn"
            onClick={() => onSendMessage(prompt)}
            disabled={isLoading}
            style={{
              fontSize: '0.74rem',
              whiteSpace: 'nowrap',
              padding: '4px 10px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.02)',
              gap: '4px',
            }}
          >
            <Sparkles size={11} color="var(--accent-cyan)" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="glass-panel" style={{ padding: '8px 12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          className="search-input"
          style={{ flex: 1, padding: '8px 12px', fontSize: '0.88rem' }}
          placeholder="Ask anything about your network, bandwidth, AI agents, or connection history..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="action-btn active"
          disabled={!inputQuery.trim() || isLoading}
          style={{ padding: '8px 16px', gap: '6px' }}
        >
          <Send size={14} />
          <span>Ask</span>
        </button>
      </form>
    </div>
  );
};
