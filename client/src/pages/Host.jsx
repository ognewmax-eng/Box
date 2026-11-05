import ThemeStage from '../theme/ThemeStage';
import { ConnectionLost, Wordmark } from '../components/ui';
import { HostFinalView, HostLeaderboardView, HostLobbyView, HostQuestionView } from '../views/host';
import { useHostGame } from '../hooks/useHostGame';

function HostContent({ game }) {
  if (!game.socket) return <p className="tv-md p-10">Подключение…</p>;
  if (!game.connected) {
    return <ConnectionLost detail={game.connectionError} hint="Игра сохранена: комната ждёт вашего возвращения 5 минут." onRetry={game.retry} />;
  }

  switch (game.phase) {
    case 'resuming':
      return <p className="tv-lg font-display-t p-[5cqw]">Возвращаем в игру…</p>;
    case 'replaced':
      return <p className="tv-lg font-display-t p-[5cqw]">Игра открыта в другой вкладке или на другом устройстве.</p>;
    case 'create':
      return (
        <div className="tv-pad flex h-full flex-col items-start justify-center gap-[min(3cqw,5cqh)]">
          <Wordmark size="tv-xl" />
          <p className="tv-lg max-w-[26ch]">Создайте комнату, покажите код на большом экране, и игроки войдут с телефонов.</p>
          {game.notice && <p className="tv-md font-bold">{game.notice}</p>}
          <button type="button" onClick={game.createRoom} className="btn tv-lg">Создать комнату</button>
        </div>
      );
    case 'lobby':
      return (
        <HostLobbyView
          code={game.roomCode}
          joinUrl={game.joinUrl}
          title={game.title}
          players={game.players}
          packs={game.packs}
          selectedPackId={game.selectedPackId}
          onSelectPack={game.selectPack}
          onStart={game.startGame}
          notice={game.notice}
          onEnd={game.endRoom}
        />
      );
    case 'results':
      if (game.results?.roundOver && game.showRoundLeaderboard) {
        return (
          <HostLeaderboardView
            results={game.results}
            isLast={game.questionIndex + 1 >= game.totalQuestions}
            onNext={game.nextQuestion}
          />
        );
      }
    // eslint-disable-next-line no-fallthrough
    case 'question':
      if (!game.question) return null;
      return (
        <HostQuestionView
          question={game.question}
          index={game.questionIndex}
          total={game.totalQuestions}
          timeLeft={game.timeLeft}
          totalTime={game.totalTime}
          timerStarted={game.timerStarted}
          manual={game.manualTimer}
          answered={game.answered}
          playerCount={game.players.length}
          results={game.phase === 'results' ? game.results : null}
          notice={game.notice}
          onStartTimer={game.startTimer}
          onShowResults={game.showResults}
          onNext={game.nextQuestion}
          onShowLeaderboard={game.showLeaderboard}
          onEnd={game.endRoom}
        />
      );
    case 'gameover':
      return <HostFinalView title={game.title} leaderboard={game.leaderboard} onNewRoom={game.newRoom} />;
    default:
      return null;
  }
}

export default function Host() {
  const game = useHostGame();
  const ambient = ['lobby', 'gameover', 'create'].includes(game.phase);
  return (
    <ThemeStage config={game.theme} ambient={ambient} page>
      <HostContent game={game} />
    </ThemeStage>
  );
}
