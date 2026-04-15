// src/components/ui/Select.tsx
import { useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  required?: boolean;
}

export function Select({ label, value, onChange, options, required }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
        {label}{required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}
