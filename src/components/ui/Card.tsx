import type { HTMLAttributes } from 'react';

interface Props extends HTMLAttributes<HTMLDivElement> {
  padding?: string;
}

export function Card({ padding = 'var(--space-6)', style, ...props }: Props) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        padding,
        ...style,
      }}
      {...props}
    />
  );
}
