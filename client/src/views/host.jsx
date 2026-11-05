import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AnswerTile, Banner, CodeBoxes, Confetti, QuestionMedia, ScoreList, Wordmark,
  answerGridClass, questionSizeClass,
} from '../components/ui';
import { useTheme } from '../theme/ThemeStage';
import { readableOn } from '../theme/resolveTheme';

/** Лобби: код комнаты кубиками, QR и игроки, которые появляются по мере входа. */
export function HostLobbyView({ code, joinUrl, title, players, packs, selectedPackId, onSelectPack, onStart, notice, onEnd }) {
  const theme = useTheme();
  return (
    <div className="tv-pad tv-gap flex h-full flex-col">
      <header className="flex items-center justify-between gap-4">
        <Wordmark title={title} size="tv-md" />
        {onEnd && <button type="button" onClick={onEnd} className="tv-xs underline-offset-4 hover:underline" style={{ color: 'var(--t-muted)' }}>Завершить игру</button>}
      </header>
      {notice && <Banner className="tv-sm">{notice}</Banner>}

      <div className="tv-gap grid min-h-0 flex-1 grid-cols-[auto_1fr] items-center">
        <div className="flex flex-col items-start gap-[min(2cqw,3.5cqh)]">
          <CodeBoxes code={code} className="tv-xxl" />
          <p className="tv-md max-w-[28ch]">{theme.texts.lobbyHint}</p>
          <div className="flex items-center gap-[min(1.5cqw,2.6cqh)]">
            <div className="bg-white p-[min(.7cqw,1.2cqh)]" style={{ borderRadius: 'calc(var(--t-radius) * 0.5)' }}>
              <QRCodeSVG value={joinUrl || 'https://example.com'} level="M" className="block h-[min(13cqw,23cqh)] w-[min(13cqw,23cqh)]" />
            </div>
            <p className="tv-sm max-w-[20ch] [overflow-wrap:anywhere]" style={{ color: 'var(--t-muted)' }}>{joinUrl}</p>
          </div>
        </div>

        <section aria-label="Игроки в лобби" className="flex h-full min-h-0 flex-col pl-[min(3cqw,5cqh)]">
          <p className="tv-lg font-display-t mb-[min(1cqw,1.8cqh)]">
            {players.length === 0 ? 'Ждём игроков' : `В игре: ${players.length}`}
          </p>
          <ul className="flex min-h-0 flex-1 flex-wrap content-start gap-[min(.8cqw,1.4cqh)] overflow-hidden">
            {players.map((player, i) => (
              <motion.li
                key={player.id}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: player.connected === false ? 0.45 : 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className="tv-md font-bold px-[0.7em] py-[0.3em]"
                style={{ background: theme.answers[i % 4], color: readableOn(theme.answers[i % 4]), borderRadius: 'calc(var(--t-radius) * 0.6)' }}
              >
                {player.nickname}
              </motion.li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="tv-gap flex items-center justify-between">
        <label className="tv-sm flex min-w-0 flex-1 items-center gap-[0.7em]">
          <span className="shrink-0">Игра</span>
          <select
            value={selectedPackId}
            onChange={(e) => onSelectPack?.(e.target.value)}
            className="field max-w-[40ch]"
          >
            <option value="">Пробный вопрос</option>
            {packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.title}</option>)}
          </select>
        </label>
        <button type="button" onClick={onStart} className="btn tv-md"><Play className="h-[1em] w-[1em]" fill="currentColor" aria-hidden="true" />Начать игру</button>
      </footer>
    </div>
  );
}

function HostHeader({ question, index, total, right }) {
  return (
    <header className="tv-sm flex items-center justify-between gap-4">
      <span>
        {question.roundTitle && <strong>{question.roundTitle}. </strong>}
        <span style={{ color: 'var(--t-muted)' }}>Вопрос {index + 1} из {total}</span>
      </span>
      {right}
    </header>
  );
}

/**
 * Вопрос и показ ответа на одном экране: плашки остаются на месте,
 * а неверные гаснут, поэтому зал видит, что именно изменилось.
 */
export function HostQuestionView({
  question, index, total, timeLeft, totalTime, timerStarted, manual, answered, playerCount,
  results, onStartTimer, onShowResults, onNext, onShowLeaderboard, onEnd, notice,
}) {
  const theme = useTheme();
  const closed = Boolean(results);
  const reveal = closed && !results.answersHidden;
  const showDrain = !closed && timerStarted;
  const isLast = index + 1 >= total;
  const isOpen = question.type === 'open';
  const options = question.options || [];
  const hasMedia = Boolean(question.image || question.video || question.audio);

  return (
    <div className="tv-pad tv-gap relative flex h-full flex-col">
      {showDrain && (
        <div
          key={`${index}-${totalTime}`}
          className="drain"
          style={{ animationDuration: `${timeLeft}s`, '--drain-from': timeLeft / totalTime }}
        />
      )}
      <HostHeader
        question={question}
        index={index}
        total={total}
        right={!closed && (manual && !timerStarted ? (
          <button type="button" onClick={onStartTimer} className="btn tv-sm">Запустить таймер</button>
        ) : (
          <span className="font-display-t tv-xl tabular-nums" role="timer" style={{ color: timeLeft <= 5 ? 'var(--t-accent)' : undefined }}>{timeLeft}</span>
        ))}
      />
      {notice && <Banner className="tv-sm">{notice}</Banner>}

      {/* В вопросе с картинкой она и есть главное: занимает половину экрана по всей высоте */}
      <div className="tv-gap flex min-h-0 flex-1">
        <div className="tv-gap flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <h1 className={`font-display-t ${hasMedia ? 'tv-lg' : questionSizeClass(question.question)} max-w-[32ch] [overflow-wrap:anywhere]`}>{question.question}</h1>
          </div>
          {isOpen ? (
            <OpenAnswerPanel reveal={reveal} closed={closed} results={results} />
          ) : (
            <div className={`tv-gap grid ${answerGridClass(options.length)} ${options.length > 6 || (hasMedia && options.length > 4) ? 'tv-sm' : options.length > 4 || hasMedia ? 'tv-ms' : 'tv-md'}`}>
              {options.map((option, i) => (
                <AnswerTile
                  key={i}
                  index={i}
                  text={option}
                  reveal={reveal}
                  correctIndex={results?.correctIndex}
                  count={theme.options.showAnswerCounts ? results?.answerCounts?.[i] : undefined}
                  className="min-h-[min(9cqw,15cqh)]"
                />
              ))}
            </div>
          )}
        </div>
        {hasMedia && <QuestionMedia question={question} className="w-[40%]" />}
      </div>

      <footer className="tv-gap flex items-center justify-between">
        <div className="tv-sm min-w-0 flex-1">
          {reveal && <TopScores entries={results.playerScores} label={theme.texts.pointsLabel} />}
          {closed && !reveal && <strong className="tabular-nums">Ответы приняты: {results.answeredCount} из {playerCount}</strong>}
          {!closed && (
            <AnsweredStatus answered={answered} playerCount={playerCount} showNames={theme.options.showAnswererNames} />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-[1em]">
          {onEnd && <button type="button" onClick={onEnd} className="tv-xs underline-offset-4 hover:underline" style={{ color: 'var(--t-muted)' }}>Завершить игру</button>}
          {!closed && <button type="button" onClick={onShowResults} className="btn tv-md">{theme.options.showAnswers ? 'Показать ответ' : 'Закрыть ответы'}</button>}
          {closed && results.roundOver && <button type="button" onClick={onShowLeaderboard} className="btn tv-md">Таблица раунда</button>}
          {closed && !results.roundOver && <button type="button" onClick={onNext} className="btn tv-md">{isLast ? 'К итогам' : 'Следующий вопрос'}</button>}
        </div>
      </footer>
    </div>
  );
}

function OpenAnswerPanel({ reveal, closed, results }) {
  if (closed && !reveal) {
    return <p className="tv-md py-[0.6em]" style={{ color: 'var(--t-muted)' }}>Правильные ответы будут в конце игры.</p>;
  }
  if (!reveal) {
    return <p className="tv-md py-[0.6em]" style={{ color: 'var(--t-muted)' }}>Игроки вводят ответ на телефонах.</p>;
  }
  return (
    <div className="flex min-h-0 flex-col gap-[min(1cqw,1.8cqh)]">
      <p className="tv-lg font-display-t px-[0.6em] py-[0.35em] self-start" style={{ background: 'var(--t-good)', color: 'var(--t-on-good)', borderRadius: 'var(--t-radius)' }}>
        {results.correctAnswer}
      </p>
      <ul className="tv-sm flex max-h-[24cqh] flex-wrap gap-[0.5em] overflow-hidden">
        {(results.openAnswers ?? []).map((answer) => (
          <li
            key={answer.nickname}
            className="px-[0.7em] py-[0.25em]"
            style={{
              background: 'var(--t-surface)',
              borderRadius: 'calc(var(--t-radius) * 0.6)',
              boxShadow: answer.correct ? 'inset 0 0 0 0.14em var(--t-good)' : undefined,
              opacity: answer.correct ? 1 : 0.65,
            }}
          >
            <strong>{answer.nickname}:</strong> {answer.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnsweredStatus({ answered, playerCount, showNames }) {
  if (answered.length === 0) return <span style={{ color: 'var(--t-muted)' }}>Пока никто не ответил</span>;
  return (
    <span className="block truncate">
      <strong className="tabular-nums">Ответили {answered.length} из {playerCount}</strong>
      {showNames && <span style={{ color: 'var(--t-muted)' }}>: {answered.map((a) => a.nickname).join(', ')}</span>}
    </span>
  );
}

function TopScores({ entries, label }) {
  return (
    <span className="block truncate">
      <strong>{label}: </strong>
      {entries.slice(0, 5).map((entry) => `${entry.nickname} ${entry.score}`).join(', ')}
    </span>
  );
}

export function HostLeaderboardView({ results, isLast, onNext }) {
  const theme = useTheme();
  const entries = results.roundLeaderboard ?? results.playerScores ?? [];
  return (
    <div className="tv-pad tv-gap flex h-full flex-col">
      <h1 className="font-display-t tv-xl">Итоги раунда: {results.roundTitle || results.roundNumber}</h1>
      <p className="tv-sm" style={{ color: 'var(--t-muted)' }}>{theme.texts.pointsLabel}</p>
      <ScoreList entries={entries.slice(0, 8)} className="tv-md min-h-0 flex-1" />
      <div className="flex justify-end">
        <button type="button" onClick={onNext} className="btn tv-md">{isLast ? 'К итогам' : 'Следующий раунд'}</button>
      </div>
    </div>
  );
}

const PODIUM_ORDER = [1, 0, 2];
const PODIUM_HEIGHT = ['70%', '54%', '40%'];
const PODIUM_DELAY = [1.1, 0.6, 0.1];

/** Финал: пьедестал вырастает снизу вверх, третье место первым. Главный момент вечера. */
export function HostFinalView({ title, leaderboard, answerReview, onNewRoom, celebrate = true }) {
  const theme = useTheme();
  const [reviewOpen, setReviewOpen] = useState(false);

  if (reviewOpen && answerReview) {
    return (
      <div className="tv-pad tv-gap flex h-full flex-col">
        <h1 className="font-display-t tv-xl">Правильные ответы</h1>
        <ol className="tv-sm min-h-0 flex-1 list-inside list-decimal overflow-y-auto [column-gap:3cqw] [columns:2]">
          {answerReview.map((item) => (
            <li key={item.question} className="mb-[0.7em] break-inside-avoid">
              {item.question} <strong style={{ color: 'var(--t-accent)' }}>{item.answer}</strong>
            </li>
          ))}
        </ol>
        <div className="flex justify-end">
          <button type="button" onClick={() => setReviewOpen(false)} className="btn btn-quiet tv-sm">К итоговой таблице</button>
        </div>
      </div>
    );
  }

  const top = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3, 9);
  return (
    <div className="tv-pad tv-gap relative flex h-full flex-col">
      {celebrate && <Confetti />}
      <header className="flex items-center justify-between gap-4">
        <h1 className="font-display-t tv-xl">{theme.texts.finalTitle}</h1>
        <Wordmark title={title} size="tv-sm" />
      </header>
      <div className="tv-gap flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 items-end justify-center gap-[min(1.2cqw,2cqh)]">
          {PODIUM_ORDER.filter((place) => top[place]).map((place) => (
            <motion.div
              key={place}
              className="flex h-full max-w-[24cqw] flex-1 flex-col justify-end"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: PODIUM_DELAY[place], type: 'spring', stiffness: 170, damping: 19 }}
            >
              <p className="tv-lg mb-[0.3em] truncate text-center font-bold">{top[place].nickname}</p>
              <div
                className="flex flex-col items-center justify-start pt-[0.5em]"
                style={{
                  height: PODIUM_HEIGHT[place],
                  background: theme.answers[place],
                  color: readableOn(theme.answers[place]),
                  borderRadius: 'var(--t-radius) var(--t-radius) 0 0',
                }}
              >
                <span className="font-display-t tv-xl leading-none">{place + 1}</span>
                <span className="tv-md font-bold tabular-nums">{top[place].score}</span>
              </div>
            </motion.div>
          ))}
        </div>
        {rest.length > 0 && <div className="w-[26%] self-end"><ScoreList entries={rest} className="tv-sm" /></div>}
      </div>
      <div className="flex justify-end gap-[1em]">
        {answerReview && <button type="button" onClick={() => setReviewOpen(true)} className="btn tv-sm">Показать правильные ответы</button>}
        {onNewRoom && <button type="button" onClick={onNewRoom} className="btn btn-quiet tv-sm">Новая комната</button>}
      </div>
    </div>
  );
}
