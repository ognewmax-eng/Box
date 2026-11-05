import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Client from './Client';
import { SOCKET_EVENTS } from '../constants';

const mockSocket = vi.hoisted(() => ({ current: null }));

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    socket: mockSocket.current,
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
    localStorage.clear();
    mockSocket.current = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
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
    expect(screen.getByRole('img', { name: 'BOX PARTY' })).toBeInTheDocument();
  });
});

describe('Client: игра', () => {
  const makeSocket = () => {
    const handlers = {};
    return {
      handlers,
      connected: true,
      emit: vi.fn(),
      on: vi.fn((event, handler) => { handlers[event] = handler; }),
      off: vi.fn(),
    };
  };

  beforeEach(() => {
    localStorage.clear();
    mockSocket.current = makeSocket();
  });

  it('показывает буквы для всех вариантов, а не только A-D', async () => {
    renderClient();
    act(() => mockSocket.current.handlers[SOCKET_EVENTS.QUESTION_START]({
      questionIndex: 0,
      total: 1,
      type: 'choice',
      question: 'Какой?',
      options: ['1', '2', '3', '4', '5', '6'],
      timeSec: 15,
    }));
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F']) {
      expect(await screen.findByText(letter)).toBeInTheDocument();
    }
  });

  it('при входе запоминает сессию, при обновлении страницы запрашивает возврат', () => {
    const first = render(<BrowserRouter><Client /></BrowserRouter>);
    expect(mockSocket.current.emit).not.toHaveBeenCalled();
    act(() => mockSocket.current.handlers[SOCKET_EVENTS.JOIN_SUCCESS]({ code: 'ABCD', token: 't-1' }));
    first.unmount();

    mockSocket.current = makeSocket();
    renderClient();
    expect(mockSocket.current.emit).toHaveBeenCalledWith(SOCKET_EVENTS.RESUME_SESSION, { code: 'ABCD', token: 't-1' });
    expect(screen.getByText('Возвращаем в игру…')).toBeInTheDocument();
  });

  it('после возврата показывает вопрос и уже отправленный ответ', () => {
    localStorage.setItem('box.playerSession', JSON.stringify({ code: 'ABCD', token: 't-1' }));
    renderClient();
    act(() => mockSocket.current.handlers[SOCKET_EVENTS.SESSION_RESUMED]({
      code: 'ABCD',
      nickname: 'Аня',
      state: 'QUESTION',
      hostConnected: false,
      showRoundLeaderboard: false,
      myAnswer: 1,
      question: { questionIndex: 0, total: 1, type: 'choice', question: 'Какой?', options: ['1', '2'], timeSec: 15, remainingSec: 7, timerStarted: true },
    }));
    expect(screen.getByText('Какой?')).toBeInTheDocument();
    expect(screen.getByText('Ответ принят!')).toBeInTheDocument();
    expect(screen.getByText(/Ведущий потерял связь/)).toBeInTheDocument();
  });

  it('недействительная сессия очищается и открывается форма входа', () => {
    localStorage.setItem('box.playerSession', JSON.stringify({ code: 'ABCD', token: 't-1' }));
    renderClient();
    act(() => mockSocket.current.handlers[SOCKET_EVENTS.SESSION_INVALID]());
    expect(localStorage.getItem('box.playerSession')).toBeNull();
    expect(screen.getByLabelText('Код комнаты')).toBeInTheDocument();
  });
});

describe('Client: игра без показа ответов', () => {
  it('не показывает «Верно» или «Мимо», только что ответ записан', () => {
    localStorage.clear();
    const handlers = {};
    mockSocket.current = { connected: true, emit: vi.fn(), off: vi.fn(), on: (event, handler) => { handlers[event] = handler; } };
    render(<BrowserRouter><Client /></BrowserRouter>);
    act(() => handlers[SOCKET_EVENTS.SESSION_RESUMED]({
      code: 'ABCD',
      nickname: 'Аня',
      state: 'RESULTS',
      hostConnected: true,
      showRoundLeaderboard: false,
      myAnswer: 1,
      question: { questionIndex: 0, total: 2, type: 'choice', question: 'Q', options: ['a', 'b'], timeSec: 15 },
      results: { answersHidden: true, answeredCount: 1, playerScores: [], roundOver: false },
    }));
    expect(screen.getByText(/Ответ записан/)).toBeInTheDocument();
    expect(screen.queryByText('Верно')).toBeNull();
    expect(screen.queryByText('Мимо')).toBeNull();
  });
});
