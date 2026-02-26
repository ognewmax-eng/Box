import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Client from './Client';

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    socket: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
    connected: true,
    retry: vi.fn(),
  }),
}));

function renderClient() {
  return render(
    <BrowserRouter>
      <Client />
    </BrowserRouter>
  );
}

describe('Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows join form with labels linked to inputs', () => {
    renderClient();
    const roomLabel = screen.getByText('Код комнаты');
    const nameLabel = screen.getByText('Ваше имя');
    expect(roomLabel).toHaveAttribute('for', 'client-room-code');
    expect(nameLabel).toHaveAttribute('for', 'client-nickname');
    expect(document.getElementById('client-room-code')).toBeInTheDocument();
    expect(document.getElementById('client-nickname')).toBeInTheDocument();
  });

  it('room code input has maxLength 4', () => {
    renderClient();
    const input = document.getElementById('client-room-code');
    expect(input).toHaveAttribute('maxLength', '4');
  });

  it('shows BOX PARTY title on join screen', () => {
    renderClient();
    expect(screen.getByText(/BOX/)).toBeInTheDocument();
    expect(screen.getByText(/PARTY/)).toBeInTheDocument();
  });
});
