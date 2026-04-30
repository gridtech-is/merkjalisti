import { useRef, useState } from 'react';
import { useApi } from '../context/ApiContext';
import type { BaySignal, SignalComment } from '../types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('is-IS', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  signal: BaySignal;
  onUpdate: (id: string, patch: Partial<BaySignal>) => void;
  onSave?: () => Promise<void>;
  onClose: () => void;
}

export function SignalCommentsModal({ signal, onUpdate, onSave, onClose }: Props) {
  const { userName } = useApi();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const comments: SignalComment[] = signal.review_comments ?? [];
  const legacyComment = !comments.length ? signal.review_comment : null;

  const handleAdd = () => {
    const t = text.trim();
    if (!t) return;
    const next: SignalComment[] = [...comments, {
      id: uuid(),
      author: userName ?? 'Óþekktur',
      text: t,
      created_at: new Date().toISOString(),
    }];
    onUpdate(signal.id, { review_comments: next, review_comment: null, review_flagged: true });
    setText('');
    // Defer save until after React re-renders and bayFileRef.current is updated
    setTimeout(() => {
      onSave?.();
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  };

  const handleResolve = () => {
    onUpdate(signal.id, { review_flagged: false });
    setTimeout(() => onSave?.(), 0);
    onClose();
  };

  const handleClear = () => {
    onUpdate(signal.id, { review_comments: [], review_comment: null, review_flagged: false });
    setTimeout(() => onSave?.(), 0);
    onClose();
  };

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--surface-alt)', border: '1px solid var(--line)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text)',
    padding: '8px 10px', fontSize: '13px', outline: 'none',
    resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', width: '440px', maxHeight: '80vh', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>Athugasemdir</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'monospace', marginTop: '2px' }}>
              {signal.equipment_code} · {signal.signal_name}
              {signal.name_is && <span style={{ fontFamily: 'inherit', marginLeft: '6px', color: 'var(--text-secondary)' }}>— {signal.name_is}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--muted)', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        {/* Comment list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4) var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {legacyComment && (
            <div style={{ background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-3)', borderLeft: '3px solid var(--warn)' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Eldri athugasemd</div>
              <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5 }}>{legacyComment}</div>
            </div>
          )}
          {!legacyComment && comments.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: 'var(--space-6) 0' }}>
              Engar athugasemdir enn
            </div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ borderLeft: '3px solid var(--accent)', paddingLeft: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{c.author}</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{formatDate(c.created_at)}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.text}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: '1px solid var(--line)' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Skrifaðu athugasemd... (Ctrl+Enter til að senda)"
            rows={3}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && text.trim()) {
                e.preventDefault();
                handleAdd();
              }
            }}
            style={inp}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {signal.review_flagged && comments.length > 0 && (
                <button type="button" onClick={handleResolve} style={{ fontSize: '11px', color: 'var(--success, #22c55e)', background: 'none', border: '1px solid color-mix(in srgb, var(--success, #22c55e) 40%, transparent)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer' }}>
                  Búið að laga
                </button>
              )}
              <button type="button" onClick={handleClear} style={{ fontSize: '11px', color: 'var(--danger)', background: 'none', border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer' }}>
                Hreinsa allt
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!text.trim()}
              style={{ fontSize: '12px', fontWeight: 600, background: text.trim() ? 'var(--accent)' : 'var(--surface-alt)', color: text.trim() ? '#fff' : 'var(--muted)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 18px', cursor: text.trim() ? 'pointer' : 'default' }}
            >
              Senda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
