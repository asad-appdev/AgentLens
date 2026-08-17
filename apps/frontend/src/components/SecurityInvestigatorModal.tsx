import React, { useState } from 'react';
import {
  X,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Shield,
  Send,
  Loader,
  Sparkles,
  Bot,
} from 'lucide-react';

import { SecurityInvestigationResult } from '@network-monitor/shared';
import { investigateSecurityTarget } from '../services/api.js';

export interface SecurityInvestigatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string | null;
  initialResult?: SecurityInvestigationResult | null;
}

export const SecurityInvestigatorModal: React.FC<SecurityInvestigatorModalProps> = ({
  isOpen,
  onClose,
  targetId,
  initialResult,
}) => {
  const [result, setResult] = useState<SecurityInvestigationResult | null>(initialResult || null);
  const [question, setQuestion] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);

  React.useEffect(() => {
    if (initialResult) {
      setResult(initialResult);
    } else if (targetId && isOpen) {
      handleInvestigate();
    }
  }, [targetId, isOpen, initialResult]);

  const handleInvestigate = async (customQuestion?: string) => {
    if (!targetId) return;
    setIsQuerying(true);
    try {
      const res = await investigateSecurityTarget(targetId, customQuestion || question);
      setResult(res);
    } catch {
      // fallback handled in backend
    } finally {
      setIsQuerying(false);
    }
  };

  if (!isOpen || !targetId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-panel"
        style={{
          width: '100%',
          maxWidth: 820,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          padding: 28,
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(168, 85, 247, 0.25))',
                border: '1px solid rgba(0, 240, 255, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#00f0ff',
                boxShadow: '0 0 20px rgba(0, 240, 255, 0.2)',
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                AI Security Investigator
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Deterministic evidence correlation & local reasoning • Target: <strong style={{ color: '#00f0ff' }}>{targetId}</strong>
              </span>
            </div>
          </div>
          <button className="action-btn" onClick={onClose} style={{ padding: 8, borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>

        {/* Question Prompt Bar */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
            }}
          >
            <Bot size={18} color="#00f0ff" />
            <input
              type="text"
              placeholder="Ask investigator (e.g. 'Why was this process flagged as suspicious?')"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvestigate()}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            />
          </div>

          <button
            className="action-btn"
            onClick={() => handleInvestigate()}
            disabled={isQuerying}
            style={{
              background: 'linear-gradient(135deg, #00f0ff 0%, #38bdf8 100%)',
              color: '#080c14',
              fontWeight: 800,
              padding: '0 20px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 0 16px rgba(0, 240, 255, 0.3)',
            }}
          >
            {isQuerying ? <Loader size={16} className="spin" /> : <Send size={16} />}
            <span>Analyze</span>
          </button>
        </div>

        {isQuerying && !result ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader size={36} className="spin" color="#00f0ff" style={{ margin: '0 auto 16px' }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Synthesizing observable evidence and correlating telemetry...</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Checking process tree, file access metadata, and destination history</div>
          </div>
        ) : result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 1. Observed Facts */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.06) 0%, rgba(13, 20, 36, 0.8) 100%)',
                border: '1px solid rgba(0, 240, 255, 0.25)',
                padding: 16,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00f0ff', fontWeight: 800, fontSize: '0.86rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                <CheckCircle size={17} />
                <span>1. Observed Facts (High Certainty Telemetry)</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.86rem', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {result.observedFacts.map((fact, idx) => (
                  <li key={idx}>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#a5f3fc' }}>{fact}</code>
                  </li>
                ))}
              </ul>
            </div>

            {/* 2. Inferences */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(13, 20, 36, 0.8) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: 16,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontWeight: 800, fontSize: '0.86rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                <AlertTriangle size={17} />
                <span>2. Logical Inferences & Deductions</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.86rem', display: 'flex', flexDirection: 'column', gap: 5, lineHeight: 1.5 }}>
                {result.inferences.map((inf, idx) => (
                  <li key={idx}>{inf}</li>
                ))}
              </ul>
            </div>

            {/* 3. What Cannot Be Confirmed */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.06) 0%, rgba(13, 20, 36, 0.8) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                padding: 16,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c084fc', fontWeight: 800, fontSize: '0.86rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                <HelpCircle size={17} />
                <span>3. What Cannot Be Confirmed (Observation Limits)</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.86rem', display: 'flex', flexDirection: 'column', gap: 5, lineHeight: 1.5 }}>
                {result.whatCannotBeConfirmed.map((limit, idx) => (
                  <li key={idx}>{limit}</li>
                ))}
              </ul>
            </div>

            {/* 4. Recommended Actions */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(13, 20, 36, 0.8) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: 16,
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontWeight: 800, fontSize: '0.86rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                <Shield size={17} />
                <span>4. Recommended Next Steps</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.86rem', display: 'flex', flexDirection: 'column', gap: 5, lineHeight: 1.5 }}>
                {result.recommendedActions.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>

            {/* Provider & Timestamp Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                paddingTop: 8,
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <span>
                Investigation Engine: <strong style={{ color: '#00f0ff' }}>{result.providerUsed.toUpperCase()}</strong>
              </span>
              <span>Evaluated: {new Date(result.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
