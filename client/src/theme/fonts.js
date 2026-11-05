// Шрифты лежат в сборке: игра должна выглядеть одинаково и без интернета.
// Браузер скачивает с сервера игры только те файлы, что нужны текущей теме.
import '@fontsource/unbounded/cyrillic-500.css';
import '@fontsource/unbounded/latin-500.css';
import '@fontsource/unbounded/cyrillic-800.css';
import '@fontsource/unbounded/latin-800.css';
import '@fontsource/onest/cyrillic-400.css';
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/cyrillic-700.css';
import '@fontsource/onest/latin-700.css';
import '@fontsource/golos-text/cyrillic-400.css';
import '@fontsource/golos-text/latin-400.css';
import '@fontsource/golos-text/cyrillic-700.css';
import '@fontsource/golos-text/latin-700.css';
import '@fontsource/yeseva-one/cyrillic-400.css';
import '@fontsource/yeseva-one/latin-400.css';
import '@fontsource/neucha/cyrillic-400.css';
import '@fontsource/neucha/latin-400.css';
import '@fontsource/oswald/cyrillic-400.css';
import '@fontsource/oswald/latin-400.css';
import '@fontsource/oswald/cyrillic-700.css';
import '@fontsource/oswald/latin-700.css';
import '@fontsource/pt-serif/cyrillic-400.css';
import '@fontsource/pt-serif/latin-400.css';
import '@fontsource/pt-serif/cyrillic-700.css';
import '@fontsource/pt-serif/latin-700.css';
import '@fontsource/playfair-display/cyrillic-700.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/pixelify-sans/cyrillic-500.css';
import '@fontsource/pixelify-sans/latin-500.css';
import '@fontsource/comfortaa/cyrillic-700.css';
import '@fontsource/comfortaa/latin-700.css';
import '@fontsource/lobster/cyrillic-400.css';
import '@fontsource/lobster/latin-400.css';
import '@fontsource/rubik/cyrillic-400.css';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/cyrillic-800.css';
import '@fontsource/rubik/latin-800.css';

export const FONTS = [
  { id: 'unbounded', name: 'Unbounded', family: "'Unbounded'", weight: 800 },
  { id: 'onest', name: 'Onest', family: "'Onest'", weight: 700 },
  { id: 'golos-text', name: 'Golos', family: "'Golos Text'", weight: 700 },
  { id: 'rubik', name: 'Rubik', family: "'Rubik'", weight: 800 },
  { id: 'oswald', name: 'Oswald', family: "'Oswald'", weight: 700 },
  { id: 'comfortaa', name: 'Comfortaa', family: "'Comfortaa'", weight: 700 },
  { id: 'yeseva-one', name: 'Yeseva One', family: "'Yeseva One'", weight: 400 },
  { id: 'playfair-display', name: 'Playfair Display', family: "'Playfair Display'", weight: 700 },
  { id: 'pt-serif', name: 'PT Serif', family: "'PT Serif'", weight: 700 },
  { id: 'neucha', name: 'Neucha', family: "'Neucha'", weight: 400 },
  { id: 'lobster', name: 'Lobster', family: "'Lobster'", weight: 400 },
  { id: 'pixelify-sans', name: 'Pixelify Sans', family: "'Pixelify Sans'", weight: 500 },
];

export function fontById(id) {
  return FONTS.find((font) => font.id === id) ?? FONTS[0];
}
