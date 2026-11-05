import { Check, X, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnswerTile, CodeBoxes, QuestionMedia, ScoreList, Wordmark } from '../components/ui';
import { useTheme } from '../theme/ThemeStage';
import { ROOM_CODE_LENGTH } from '../constants';

export function PlayerJoinView({ code, onCodeChange, nickname, onNicknameChange, title, connected, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="mx-auto flex h-full w-full max-w-md flex-col gap-6 overflow-y-auto p-5">
      <header className="pt-3"><Wordmark title={title} size="text-xl" /></header>
      <div>
        <label htmlFor="client-room-code" className="mb-2 block font-bold">Код комнаты</label>
        <div className="relative w-fit">
          <CodeBoxes code={code} className="text-[min(3rem,12.5cqw)]" decorative />
          <input
            id="client-room-code"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            value={code}
            onChange={(e) => onCodeChange(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH))}
            maxLength={ROOM_CODE_LENGTH}
            className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent"
          />
        </div>
      </div>
      <div>
        <label htmlFor="client-nickname" className="mb-2 block font-bold">Ваше имя</label>
        <input
          id="client-nickname"
          type="text"
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value.slice(0, 20))}
          placeholder="Как вас показать на экране"
          autoComplete="off"
          className="field text-lg"
        />
      </div>
      <button type="submit" disabled={!connected || code.trim().length < ROOM_CODE_LENGTH} className="btn mt-auto w-full py-4 text-lg">Войти в игру</button>
    </form>
  );
}

export function PlayerWaitingView({ nickname, title }) {
  const theme = useTheme();
  return (
    <div className="mx-auto flex h-full max-w-md flex-col justify-center gap-6 p-6">
      <Wordmark title={title} size="text-xl" />
      <h1 className="font-display-t text-4xl leading-tight [overflow-wrap:anywhere]">{nickname ? `${nickname}, вы в игре` : 'Вы в игре'}</h1>
      <p className="text-lg" style={{ color: 'var(--t-muted)' }}>{theme.texts.waitMessage}</p>
    </div>
  );
}

export function PlayerQuestionView({
  question, index, total, timeLeft, totalTime, timerStarted, manual, selected,
  openText, onOpenTextChange, onAnswer, onSubmitOpen,
}) {
  const options = question.options || [];
  const answered = selected !== null;
  // Плашки делят экран поровну: по ним легко попасть, не глядя на телефон
  const manyOptions = options.length > 4;
  return (
    <div className="relative mx-auto flex h-full max-w-md flex-col gap-3 p-4">
      {timerStarted && !answered && (
        <div key={`${index}-${totalTime}`} className="drain" style={{ animationDuration: `${timeLeft}s`, '--drain-from': timeLeft / totalTime }} />
      )}
      <header className="flex items-center justify-between font-bold">
        <span style={{ color: 'var(--t-muted)' }}>{index + 1} из {total}</span>
        {manual && !timerStarted
          ? <span className="text-sm" style={{ color: 'var(--t-muted)' }}>Ведущий ещё не запустил таймер</span>
          : <span className="font-display-t text-2xl tabular-nums" role="timer">{timeLeft}</span>}
      </header>
      <h1 className={`font-display-t leading-snug [overflow-wrap:anywhere] ${question.question.length > 90 ? 'text-lg' : 'text-xl'}`}>{question.question}</h1>
      <QuestionMedia question={question} className="max-h-[28%]" />

      {question.type === 'open' ? (
        <form onSubmit={onSubmitOpen} className="flex flex-1 flex-col gap-3">
          <input
            type="text"
            value={openText}
            onChange={(e) => onOpenTextChange(e.target.value)}
            placeholder="Ваш ответ"
            disabled={answered}
            maxLength={200}
            autoComplete="off"
            aria-label="Ваш ответ"
            className="field text-lg"
          />
          <button type="submit" disabled={answered || !openText.trim()} className="btn w-full py-4 text-lg">Отправить ответ</button>
        </form>
      ) : (
        <div className={`grid min-h-0 flex-1 auto-rows-fr gap-3 ${manyOptions ? 'overflow-y-auto' : ''} ${options.length === 3 ? 'grid-cols-1' : options.length <= 4 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {options.map((option, i) => (
            <AnswerTile
              key={i}
              index={i}
              text={option}
              selected={selected}
              disabled={answered}
              onClick={() => onAnswer(i)}
              className={manyOptions ? 'min-h-16 text-sm' : 'text-lg'}
            />
          ))}
        </div>
      )}
      {answered && <p className="text-center font-bold" role="status">Ответ принят!</p>}
    </div>
  );
}

/** Результат заливает весь экран: понятно с первого взгляда, даже если телефон лежит на столе. */
export function PlayerResultView({ results, nickname, answered, showRoundLeaderboard }) {
  const theme = useTheme();
  const isCorrect = results?.correctNicknames?.includes(nickname);
  const scores = results?.playerScores ?? [];
  const place = scores.findIndex((entry) => entry.nickname === nickname);
  const score = place >= 0 ? scores[place].score : 0;

  if (results?.roundOver && showRoundLeaderboard) {
    return <PlayerLeaderboardView heading={`Итоги раунда: ${results.roundTitle || results.roundNumber}`} entries={results.roundLeaderboard ?? scores} nickname={nickname} />;
  }

  const tone = isCorrect
    ? { bg: 'var(--t-good)', fg: 'var(--t-on-good)', title: theme.texts.correctText, Icon: Check }
    : answered
      ? { bg: 'var(--t-bad)', fg: 'var(--t-on-bad)', title: theme.texts.wrongText, Icon: X }
      : { bg: 'var(--t-surface)', fg: 'var(--t-text)', title: 'Ответа нет', Icon: Minus };

  return (
    <motion.div
      className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ background: tone.bg, color: tone.fg }}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <tone.Icon className="h-20 w-20" strokeWidth={3.5} aria-hidden="true" />
      <h1 className="font-display-t text-5xl leading-none [overflow-wrap:anywhere]">{tone.title}</h1>
      {results?.correctAnswer && <p className="text-lg">Правильный ответ: <strong>{results.correctAnswer}</strong></p>}
      {theme.options.showLeaderboardOnPhones && place >= 0 && (
        <p className="text-xl font-bold">{theme.texts.pointsLabel}: {score}. Место: {place + 1} из {scores.length}</p>
      )}
    </motion.div>
  );
}

export function PlayerLeaderboardView({ heading, entries, nickname, onNewGame }) {
  const theme = useTheme();
  const place = entries.findIndex((entry) => entry.nickname === nickname);
  return (
    <div className="mx-auto flex h-full max-w-md flex-col gap-4 p-5">
      <h1 className="font-display-t text-3xl leading-tight">{heading}</h1>
      {theme.options.showLeaderboardOnPhones ? (
        <ScoreList entries={entries} highlight={nickname} className="min-h-0 flex-1 overflow-y-auto text-lg" />
      ) : (
        <p className="flex-1 text-2xl font-bold">{place >= 0 ? `Ваше место: ${place + 1}` : ''}</p>
      )}
      {onNewGame && <button type="button" onClick={onNewGame} className="btn btn-quiet w-full py-3">Новая игра</button>}
    </div>
  );
}

export function PlayerMessageView({ message, onBack }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <p className="text-xl font-bold">{message}</p>
      {onBack && <button type="button" onClick={onBack} className="btn btn-quiet">Назад</button>}
    </div>
  );
}
