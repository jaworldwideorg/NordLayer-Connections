import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import App from './App';

describe('App', () => {
  test('renders heading and upload controls', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /NordLayer Connections Analyzer/i })).toBeInTheDocument();
    expect(screen.getByText(/Connections CSV \(required\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Members CSV \(optional\)/i)).toBeInTheDocument();
  });
});
