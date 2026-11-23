// Animations décoratives. Elles sont toutes coupées si l'utilisateur les désactive
// dans les réglages ou si l'appareil demande de réduire les animations.

const STORAGE_KEY = 'horaires-animations';
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
let enabled = true;
try { enabled = localStorage.getItem(STORAGE_KEY) !== '0'; } catch (e) {}

export const systemReducesMotion = () => reduceQuery.matches;
export const animationsEnabled = () => enabled;
export const motionOK = () => enabled && !reduceQuery.matches;

function applyMotionClass() { document.documentElement.classList.toggle('noMotion', !motionOK()); }
reduceQuery.addEventListener?.('change', applyMotionClass);
applyMotionClass();

export function setAnimations(on) {
  enabled = on;
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (e) {}
  applyMotionClass();
}

/* ---------- Calque des effets (pétales, coccinelle) ---------- */

let layer;
export function fxLayer() {
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'fxLayer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
}
export const rand = (a, b) => a + Math.random() * (b - a);

/* ---------- 51. Pétales et feuilles ---------- */

const PETALS = {
  absence: { colors: ['#f6b56b', '#f19a4a', '#e9893b', '#f8c98d'], shape: 'leaf' },   // feuilles orange
  half: { colors: ['#ffd84d', '#f7c531', '#ffe78a', '#f2d16b'], shape: 'leaf' },      // feuilles jaunes
  bloom: { colors: ['#f5a6b3', '#f7c0ca', '#ee8fa1', '#ffd6de', '#ffe27a'], shape: 'round' } // pétales roses
};

/** Fait tomber des pétales depuis le haut de l'élément `target`. */
export function petals(target, kind = 'absence', count = 18) {
  if (!motionOK() || !target) return;
  let r = target.getBoundingClientRect();
  const host = fxLayer(), { colors, shape } = PETALS[kind];
  // Élément hors écran : les pétales tombent depuis le haut de l'écran pour rester visibles.
  if (r.bottom < 0 || r.top > innerHeight) r = { left: 0, right: innerWidth, top: 0, height: 60 };
  for (let n = 0; n < count; n++) {
    const p = document.createElement('span');
    p.className = 'petal ' + shape;
    p.style.left = rand(r.left + 8, r.right - 8) + 'px';
    p.style.top = rand(r.top - 12, r.top + r.height * 0.35) + 'px';
    p.style.width = rand(8, 14) + 'px';
    p.style.height = rand(6, 10) + 'px';
    p.style.background = colors[n % colors.length];
    host.append(p);
    const fall = rand(110, 240), drift = rand(-60, 60), sway = rand(15, 35) * (Math.random() < .5 ? -1 : 1), spin = rand(-480, 480);
    p.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 0 },
      { transform: `translate(${sway}px, ${fall * .3}px) rotate(${spin * .3}deg)`, opacity: 1, offset: .25 },
      { transform: `translate(${drift - sway}px, ${fall * .65}px) rotate(${spin * .65}deg)`, opacity: .9, offset: .6 },
      { transform: `translate(${drift}px, ${fall}px) rotate(${spin}deg)`, opacity: 0 }
    ], { duration: rand(1500, 2500), delay: rand(0, 300), easing: 'ease-out', fill: 'both' }).onfinish = () => p.remove();
  }
}

/* ---------- 53. Bourgeon du permanent, qui éclot à chaque JHV ---------- */

export const BUD_SVG = `<svg class="bud" viewBox="0 0 40 48" aria-hidden="true">
  <path d="M20 47V22" stroke="#5a9a4e" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <path d="M20 39c-7 0-10.5-4.5-11-8.5 5.5 0 10 3.5 11 8.5z" fill="#7dbb6a"/>
  <path d="M20 34c7 0 10.5-4.5 11-8.5-5.5 0-10 3.5-11 8.5z" fill="#8fc77a"/>
  <g class="budHead">
    <path d="M20 7c6.5 5 7.5 12.5 0 17.5C12.5 19.5 13.5 12 20 7z" fill="#f5a6b3"/>
    <path d="M20 24.5c-4-2.5-5.2-6.5-4.4-9.8 1.8 3.6 6.8 3.6 8.8 0 .8 3.3-.4 7.3-4.4 9.8z" fill="#7dbb6a"/>
  </g>
  <g class="flowerHead">
    <ellipse cx="20" cy="7.5" rx="4.6" ry="7" fill="#f5a6b3"/>
    <ellipse cx="20" cy="7.5" rx="4.6" ry="7" fill="#f7b8c3" transform="rotate(72 20 15.5)"/>
    <ellipse cx="20" cy="7.5" rx="4.6" ry="7" fill="#f5a6b3" transform="rotate(144 20 15.5)"/>
    <ellipse cx="20" cy="7.5" rx="4.6" ry="7" fill="#f7b8c3" transform="rotate(216 20 15.5)"/>
    <ellipse cx="20" cy="7.5" rx="4.6" ry="7" fill="#f5a6b3" transform="rotate(288 20 15.5)"/>
    <circle cx="20" cy="15.5" r="4.2" fill="#ffc83f"/>
  </g>
</svg>`;

/** `ratio` : part du permanent déjà remplie (0 à 1) ; `bloom` : un JHV vient d'être gagné. */
export function updateBud(card, ratio, bloom) {
  card.style.setProperty('--grow', Math.max(0, Math.min(1, ratio)).toFixed(3));
  if (!bloom || !motionOK()) return;
  card.classList.remove('blooming');
  void card.offsetWidth; // relance l'animation
  card.classList.add('blooming');
  petals(card, 'bloom', 30);
  setTimeout(() => card.classList.remove('blooming'), 2700);
}

/* ---------- 60. Nuage sur les compteurs négatifs, chassé par le soleil ---------- */

export const WEATHER_HTML = `<span class="weather" aria-hidden="true">
  <svg class="cloud" viewBox="0 0 34 22"><path d="M9 20a6.5 6.5 0 0 1-.6-13A8.5 8.5 0 0 1 24.5 5a7.5 7.5 0 0 1 1.5 15z" fill="#c9cfd2"/><path d="M11 20a5 5 0 0 1 .4-10 7 7 0 0 1 12.6 1.5 4.5 4.5 0 0 1 2 8.5z" fill="#dfe4e6"/></svg>
  <svg class="sun" viewBox="0 0 34 34"><g stroke="#ffc83f" stroke-width="2.6" stroke-linecap="round"><path d="M17 2v5M17 27v5M2 17h5M27 17h5M6.4 6.4l3.5 3.5M24.1 24.1l3.5 3.5M6.4 27.6l3.5-3.5M24.1 9.9l3.5-3.5"/></g><circle cx="17" cy="17" r="7" fill="#ffc83f"/></svg>
</span>`;

/** Met à jour le nuage d'une carte ; `prev` est l'ancienne valeur si elle est comparable. */
export function updateWeather(card, value, prev) {
  card.classList.toggle('cloudy', value < 0);
  if (prev === undefined || !(prev < 0 && value >= 0) || !motionOK()) return;
  card.classList.remove('sunburst');
  void card.offsetWidth;
  card.classList.add('sunburst');
  setTimeout(() => card.classList.remove('sunburst'), 1900);
}

/* ---------- 61. Coccinelle qui apporte l'heure actuelle ---------- */

const LADYBUG_SVG = `<svg viewBox="0 0 22 24"><circle cx="11" cy="5" r="4" fill="#2b2b2b"/><ellipse cx="11" cy="14" rx="9" ry="9.5" fill="#e0453f"/><path d="M11 5.5v18" stroke="#2b2b2b" stroke-width="1.4"/><circle cx="6.5" cy="11" r="1.8" fill="#2b2b2b"/><circle cx="15.5" cy="11" r="1.8" fill="#2b2b2b"/><circle cx="7" cy="17.5" r="1.6" fill="#2b2b2b"/><circle cx="15" cy="17.5" r="1.6" fill="#2b2b2b"/><circle cx="9.4" cy="3.6" r=".9" fill="#fff"/><circle cx="12.6" cy="3.6" r=".9" fill="#fff"/></svg>`;

/** La coccinelle marche de `from` jusqu'à `to`, puis `done()` est appelé et elle s'envole. */
export function ladybug(from, to, done) {
  if (!motionOK() || !from || !to) { done(); return; }
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len, angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
  const bug = document.createElement('span');
  bug.className = 'ladybug';
  bug.innerHTML = LADYBUG_SVG;
  bug.style.left = x0 + 'px';
  bug.style.top = y0 + 'px';
  fxLayer().append(bug);
  const frames = [];
  for (let s = 0; s <= 10; s++) {
    const t = s / 10, wiggle = Math.sin(t * Math.PI * 3) * 6 * (1 - t);
    frames.push({
      transform: `translate(${dx * t + px * wiggle}px, ${dy * t + py * wiggle}px) rotate(${angle + Math.sin(t * Math.PI * 10) * 16}deg) scale(${t === 0 ? .4 : 1})`,
      opacity: t === 0 ? 0 : 1,
      offset: t
    });
  }
  bug.animate(frames, { duration: Math.min(1000, 450 + len * 4), easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => {
    done();
    bug.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(${angle}deg) scale(1)`, opacity: 1 },
      { transform: `translate(${dx + 30}px, ${dy - 60}px) rotate(${angle + 50}deg) scale(1.35)`, opacity: 0 }
    ], { duration: 550, delay: 150, easing: 'ease-in', fill: 'forwards' }).onfinish = () => bug.remove();
  };
}
