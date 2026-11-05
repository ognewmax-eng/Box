function svg(body, size, color, opacity) {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="none" stroke="${color}" fill-opacity="${opacity}" stroke-opacity="${opacity}">${body}</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}

const dotsBody = (color) => `<circle cx="12" cy="12" r="2" fill="${color}" stroke="none"/>`;
const starsBody = (color) => `<path d="M20 6l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="${color}" stroke="none"/><circle cx="52" cy="48" r="1.6" fill="${color}" stroke="none"/><path d="M54 62l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="${color}" stroke="none"/>`;
const pixelsBody = (color) => `<rect x="0" y="0" width="8" height="8" fill="${color}" stroke="none"/><rect x="24" y="24" width="8" height="8" fill="${color}" stroke="none"/>`;
// Ромбы и пилообразная кайма, как в орнаменте на северной одежде
const ornamentBody = () => '<path stroke-width="2.5" d="M40 10l18 18-18 18-18-18z"/><path stroke-width="2.5" d="M40 20l8 8-8 8-8-8z"/><path stroke-width="2.5" d="M0 62l10-10 10 10 10-10 10 10 10-10 10 10 10-10 10 10"/>';

/** CSS-фон узора; цвет берётся из темы. */
export function patternStyle(pattern, color) {
  switch (pattern) {
    case 'dots':
      return { backgroundImage: svg(dotsBody(color), 24, color, 0.16) };
    case 'grid':
      return { backgroundImage: svg('<path stroke-width="1" d="M36 0H0V36"/>', 36, color, 0.14) };
    case 'ornament':
      return { backgroundImage: svg(ornamentBody(), 80, color, 0.08) };
    case 'stars':
      return { backgroundImage: svg(starsBody(color), 80, color, 0.2) };
    case 'pixels':
      return { backgroundImage: svg(pixelsBody(color), 48, color, 0.07) };
    case 'rays':
      return {
        backgroundImage: `repeating-conic-gradient(from 0deg at 50% 118%, ${color}17 0deg 9deg, transparent 9deg 18deg)`,
      };
    default:
      return null;
  }
}
