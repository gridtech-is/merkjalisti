import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export function Button({ variant = 'primary', size = 'md', style, ...props }: Props) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: size === 'sm' ? '4px 10px' : '8px 16px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid transparent',
    fontWeight: 500,
    transition: 'opacity 0.15s',
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    opacity: props.disabled ? 0.5 : 1,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#0f172a', borderColor: 'var(--accent)' },
    ghost: { background: 'transparent', color: 'var(--text)', borderColor: 'var(--line)' },
    danger: { background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: 'var(--danger-border)' },
  };
  return <button style={{ ...base, ...variants[variant], ...style }} {...props} />;
}
