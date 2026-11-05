import { useState } from 'react';
import ThemeStage from '../theme/ThemeStage';
import { HostFinalView, HostLobbyView, HostQuestionView } from '../views/host';
import { PlayerQuestionView, PlayerResultView } from '../views/player';

const SAMPLE_QUESTION = {
  type: 'choice',
  question: 'Как называется традиционное жилище народов Севера?',
  options: ['Иглу', 'Юрта', 'Чум', 'Вигвам'],
  correctIndex: 2,
};
const PLAYERS = ['Аня', 'Боря', 'Вика', 'Гриша', 'Даша'].map((nickname, i) => ({ id: String(i), nickname, connected: true }));
const SCORES = [
  { nickname: 'Вика', score: 7 }, { nickname: 'Аня', score: 6 }, { nickname: 'Гриша', score: 4 },
  { nickname: 'Боря', score: 3 }, { nickname: 'Даша', score: 2 },
];
const SCREENS = [
  { id: 'lobby', label: 'Лобби' },
  { id: 'question', label: 'Вопрос' },
  { id: 'reveal', label: 'Ответ' },
  { id: 'final', label: 'Финал' },
];

function toQuestion(raw) {
  if (raw?.type !== 'choice' || !raw.question?.trim()) return SAMPLE_QUESTION;
  const options = (raw.options ?? []).filter((option) => option?.trim());
  return options.length >= 2 ? { ...raw, options, correctIndex: Math.min(raw.correctIndex ?? 0, options.length - 1) } : SAMPLE_QUESTION;
}

/** Телефон настоящего размера, уменьшенный целиком: вёрстка та же, что у игрока. */
function PhoneFrame({ theme, children }) {
  return (
    <div className="preview-frame h-[23rem] w-[11.25rem] shrink-0 overflow-hidden" style={{ borderRadius: '1rem' }} inert="">
      <div className="h-[736px] w-[360px] origin-top-left scale-50">
        <ThemeStage config={theme}>{children}</ThemeStage>
      </div>
    </div>
  );
}

/** Настоящие экраны игры на примере: что видно здесь, то увидят игроки. */
export default function ThemePreview({ theme, title, firstQuestion }) {
  const [screen, setScreen] = useState('question');
  const question = toQuestion(firstQuestion);
  const results = {
    correctIndex: question.correctIndex,
    answerCounts: question.options.map((_, i) => (i === question.correctIndex ? 3 : 1)),
    playerScores: SCORES,
    correctNicknames: ['Вика'],
  };
  const questionProps = { question, index: 0, total: 25, timeLeft: 9, totalTime: 20, timerStarted: true, manual: false };

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Экран для просмотра" className="flex flex-wrap gap-1">
        {SCREENS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={screen === id}
            onClick={() => setScreen(id)}
            className="px-3 py-1 text-sm font-bold"
            style={{
              borderRadius: '0.4rem',
              background: screen === id ? 'var(--t-text)' : 'transparent',
              color: screen === id ? 'var(--t-bg)' : 'var(--t-text)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="preview-frame aspect-video w-full overflow-hidden" style={{ borderRadius: '0.5rem' }} inert="">
        <ThemeStage config={theme} ambient={screen === 'lobby' || screen === 'final'}>
          {screen === 'lobby' && (
            <HostLobbyView code="GAME" joinUrl="http://192.168.0.5:3000/client?room=GAME" title={title} players={PLAYERS} packs={[]} selectedPackId="" />
          )}
          {screen === 'question' && <HostQuestionView {...questionProps} answered={PLAYERS.slice(0, 2)} playerCount={5} />}
          {screen === 'reveal' && <HostQuestionView {...questionProps} answered={PLAYERS} playerCount={5} results={results} />}
          {screen === 'final' && <HostFinalView title={title} leaderboard={SCORES} celebrate={false} />}
        </ThemeStage>
      </div>

      <div className="flex flex-wrap gap-3">
        <PhoneFrame theme={theme}>
          <PlayerQuestionView {...questionProps} selected={null} openText="" />
        </PhoneFrame>
        <PhoneFrame theme={theme}>
          <PlayerResultView results={results} nickname="Вика" answered showRoundLeaderboard={false} />
        </PhoneFrame>
      </div>
    </div>
  );
}
