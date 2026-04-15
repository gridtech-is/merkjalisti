import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TokenSetup } from './TokenSetup';

describe('TokenSetup', () => {
  it('renders the form with correct fields', () => {
    render(<TokenSetup onSuccess={vi.fn()} />);
    expect(screen.getByPlaceholderText('ghp_xxxxxxxxxxxx')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tengjast' })).toBeInTheDocument();
    expect(screen.getByText(/GitHub Personal Access Token/i)).toBeInTheDocument();
  });

  it('shows Tengjast button by default', () => {
    render(<TokenSetup onSuccess={vi.fn()} />);
    expect(screen.getByRole('button')).not.toBeDisabled();
    expect(screen.getByRole('button')).toHaveTextContent('Tengjast');
  });
});
