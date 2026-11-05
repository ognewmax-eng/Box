import { useSearchParams } from 'react-router-dom';
import ThemeStage from '../theme/ThemeStage';
import { Banner, ConnectionLost } from '../components/ui';
import {
  PlayerJoinView, PlayerLeaderboardView, PlayerMessageView, PlayerQuestionView, PlayerResultView, PlayerWaitingView,
} from '../views/player';
import { usePlayerGame } from '../hooks/usePlayerGame';
import { useTheme } from '../theme/ThemeStage';

function PlayerContent({ game }) {
  const theme = useTheme();
  if (!game.socket) return <PlayerMessageView message="Подключение…" />;
  if (!game.connected) {
    return <ConnectionLost detail={game.connectionError} hint="Ваши очки сохранены, вы вернётесь в игру сами." onRetry={game.retry} />;
  }

  switch (game.screen) {
    case 'resuming':
      return <PlayerMessageView message="Возвращаем в игру…" />;
    case 'join':
      return (
        <PlayerJoinView
          code={game.roomCode}
          onCodeChange={game.setRoomCode}
          nickname={game.nickname}
          onNicknameChange={game.setNickname}
          title={game.title}
          connected={game.connected}
          onSubmit={game.joinRoom}
        />
      );
    case 'error':
      return <PlayerMessageView message={game.error} onBack={() => { game.setError(''); game.setScreen('join'); }} />;
    case 'lobby':
      return <PlayerWaitingView nickname={game.nickname} title={game.title} />;
    case 'question':
      if (!game.question) return null;
      return (
        <PlayerQuestionView
          question={game.question}
          index={game.questionIndex}
          total={game.totalQuestions}
          timeLeft={game.timeLeft}
          totalTime={game.totalTime}
          timerStarted={game.timerStarted}
          manual={game.manualTimer}
          selected={game.selectedAnswer}
          openText={game.openAnswerText}
          onOpenTextChange={game.setOpenAnswerText}
          onAnswer={game.submitAnswer}
          onSubmitOpen={game.submitOpenAnswer}
        />
      );
    case 'results':
      return (
        <PlayerResultView
          results={game.results}
          nickname={game.nickname}
          answered={game.selectedAnswer !== null}
          showRoundLeaderboard={game.showRoundLeaderboard}
        />
      );
    case 'gameover':
      return (
        <PlayerLeaderboardView
          heading={theme.texts.finalTitle}
          entries={game.leaderboard}
          nickname={game.nickname}
          onNewGame={game.newGame}
        />
      );
    default:
      return null;
  }
}

export default function Client() {
  const [searchParams] = useSearchParams();
  const game = usePlayerGame(searchParams.get('room') || '');
  const showHostLost = !game.hostConnected && ['lobby', 'question', 'results'].includes(game.screen);
  return (
    <ThemeStage config={game.theme} ambient={game.screen === 'lobby'} page className="flex flex-col">
      {showHostLost && <Banner className="m-3 text-sm">Ведущий потерял связь. Ждём его возвращения…</Banner>}
      <div className="min-h-0 flex-1"><PlayerContent game={game} /></div>
    </ThemeStage>
  );
}
