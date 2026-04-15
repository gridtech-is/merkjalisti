// src/components/ui/Input.tsx
import { useState } from 'react';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  hint?: string;
}

export function Input({ label, value, onChange, placeholder, required, type = 'text', hint }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        required={required}
        style={{
          background: 'var(--surface-alt)',
          border: `1px solid ${focused ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text)',
          padding: '8px 12px',
          fontSize: '13px',
          fontFamily: 'inherit',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
      {hint && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{hint}</span>}
    </label>
  );
}
