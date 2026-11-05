import { createContext, useContext, useEffect, useMemo } from 'react';
import { patternStyle } from './patterns';
import { resolveTheme } from './resolveTheme';

const ThemeContext = createContext(resolveTheme(null));

export const useTheme = () => useContext(ThemeContext);

function Ambient({ type, color }) {
  const flakes = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({
      left: `${(i * 37) % 100}%`,
      size: `${0.2 + ((i * 7) % 5) * 0.09}rem`,
      delay: `${-((i * 13) % 20)}s`,
      duration: `${10 + ((i * 11) % 12)}s`,
      top: `${(i * 53) % 100}%`,
    })),
    [],
  );
  return (
    <div className="ambient" aria-hidden="true">
      {flakes.map((flake, i) => (
        <span
          key={i}
          className={type === 'snow' ? 'ambient-snow' : 'ambient-star'}
          style={{
            left: flake.left,
            top: type === 'snow' ? undefined : flake.top,
            width: flake.size,
            height: flake.size,
            background: color,
            animationDelay: flake.delay,
            animationDuration: flake.duration,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Сцена с темой: задаёт CSS-переменные и слои фона. Размеры внутри считаются
 * от самой сцены, поэтому экраны одинаково выглядят на телевизоре и в превью.
 */
export default function ThemeStage({ config, ambient = false, page = false, className = '', children }) {
  const theme = useMemo(() => resolveTheme(config), [config]);
  const pattern = patternStyle(theme.pattern, theme.colors.text);

  useEffect(() => {
    if (!page) return undefined;
    const previous = document.body.style.background;
    document.body.style.background = theme.colors.bg;
    return () => { document.body.style.background = previous; };
  }, [page, theme.colors.bg]);

  return (
    <ThemeContext.Provider value={theme}>
      <div className={`stage ${className}`} style={theme.vars} data-tile={theme.tile}>
        {theme.backgroundImage && (
          <>
            <img src={theme.backgroundImage} alt="" className="stage-layer object-cover" />
            <div className="stage-layer" style={{ background: theme.colors.bg, opacity: theme.backgroundDim / 100 }} />
          </>
        )}
        {pattern && <div className="stage-layer" style={pattern} />}
        {ambient && theme.ambient !== 'none' && <Ambient type={theme.ambient} color={theme.colors.text} />}
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
