import type { HTMLAttributes } from 'react';
import type { ProjectPhase } from '../../types';

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warn' | 'danger' | 'accent';
  phase?: ProjectPhase;
}

const PHASE_COLORS: Record<ProjectPhase, string> = {
  DESIGN: 'var(--phase-design)',
  FROZEN: 'var(--phase-frozen)',
  REVIEW: 'var(--phase-review)',
  FAT: 'var(--phase-fat)',
  SAT: 'var(--phase-sat)',
};

const VARIANT_COLORS: Record<string, string> = {
  default: 'var(--text-secondary)',
  success: 'var(--success)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  accent: 'var(--accent)',
};

export function Badge({ variant = 'default', phase, style, ...props }: Props) {
  const color = phase ? PHASE_COLORS[phase] : VARIANT_COLORS[variant];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '99px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color,
        background: `${color}22`,
        border: `1px solid ${color}44`,
        ...style,
      }}
      {...props}
    />
  );
}
