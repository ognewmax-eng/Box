import { Link } from 'react-router-dom';
import { Smartphone, Tv } from 'lucide-react';
import ThemeStage, { useTheme } from '../theme/ThemeStage';
import { BoxLetters } from '../components/ui';
import { tileColors } from '../theme/resolveTheme';

function RoleTile({ to, index, Icon, title, text }) {
  const theme = useTheme();
  return (
    <Link to={to} style={tileColors(theme, index)} className="tile block p-6 sm:p-8">
      <Icon className="mb-6 h-10 w-10" strokeWidth={2.5} aria-hidden="true" />
      <h2 className="font-display-t text-2xl sm:text-3xl">{title}</h2>
      <p className="mt-2 text-base sm:text-lg">{text}</p>
    </Link>
  );
}

export default function Home() {
  return (
    <ThemeStage page>
      <div className="h-full overflow-y-auto">
      <main className="mx-auto flex min-h-full max-w-4xl flex-col justify-center gap-10 p-6 sm:p-10">
        <div>
          <BoxLetters text="BOX PARTY" className="text-2xl sm:text-4xl" />
          <p className="mt-6 max-w-[34ch] text-xl sm:text-2xl">Викторина для компании: большой экран у ведущего, ответы на телефонах.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <RoleTile to="/host" index={1} Icon={Tv} title="Вести игру" text="Откройте на компьютере или телевизоре, создайте комнату." />
          <RoleTile to="/client" index={2} Icon={Smartphone} title="Играть" text="Откройте на телефоне и введите код с большого экрана." />
        </div>
        <Link to="/admin" className="self-start font-bold underline underline-offset-4">Создать игру и настроить её вид</Link>
      </main>
      </div>
    </ThemeStage>
  );
}
