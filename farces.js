// Animations loufoques. Comme les autres, elles ne jouent que si motionOK() est vrai.
import { motionOK, petals, fxLayer, rand } from './animations.js';

const wait = ms => new Promise(r => setTimeout(r, ms));
const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/* ---------- 67. Lunettes de soleil du vendredi ---------- */

export const SHADES_HTML = `<span class="shades" aria-hidden="true"><svg viewBox="0 0 30 11"><path d="M1 2h28" stroke="#2b2b2b" stroke-width="1.6"/><path d="M2 2h10.5c0 4.5-2 8-5.5 8S2 6.5 2 2zM17.5 2H28c0 4.5-1.5 8-5 8s-5.5-3.5-5.5-8z" fill="#2b2b2b"/><path d="M4 3.5l3 0M19.5 3.5l3 0" stroke="#fff" stroke-width="1" opacity=".6" stroke-linecap="round"/></svg></span>`;

/* ---------- 68. Bâillement du lundi matin ---------- */

export const ZZZ_HTML = '<span class="zzz" aria-hidden="true"><i>z</i><i>z</i><i>Z</i></span>';

/* ---------- 69. Chapeau de magicien des horaires habituels ---------- */

const HAT_SVG = `<svg viewBox="0 0 48 44"><ellipse cx="24" cy="38" rx="22" ry="5" fill="#2f2a33"/><path d="M11 37V9c0-3 6-5 13-5s13 2 13 5v28z" fill="#3a3440"/><path d="M11 30h26v6H11z" fill="#f08aa2"/><ellipse cx="24" cy="9" rx="13" ry="4.5" fill="#26212b"/><path d="M40 6l1.2 2.6L44 9.5l-2.8.9L40 13l-1.2-2.6-2.8-.9 2.8-.9z" fill="#ffc83f"/><path d="M6 14l.8 1.7 1.8.6-1.8.6L6 18.6l-.8-1.7-1.8-.6 1.8-.6z" fill="#ffc83f"/></svg>`;

/** Un chapeau apparaît au-dessus de `button` et les heures en sortent comme des lapins vers `inputs`. */
export async function magicHat(button, inputs) {
  if (!motionOK() || !button) return;
  inputs.forEach(el => el.classList.add('hiddenValue'));
  const b = button.getBoundingClientRect(), host = fxLayer();
  const hat = document.createElement('span');
  hat.className = 'magicHat';
  hat.innerHTML = HAT_SVG;
  hat.style.left = b.left + b.width / 2 + 'px';
  hat.style.top = b.top - 6 + 'px';
  host.append(hat);
  hat.animate([
    { transform: 'translate(-50%, -100%) scale(0) rotate(-30deg)' },
    { transform: 'translate(-50%, -100%) scale(1.2) rotate(8deg)', offset: .6 },
    { transform: 'translate(-50%, -100%) scale(1) rotate(0)' }
  ], { duration: 450, easing: 'ease-out', fill: 'forwards' });
  await wait(450);
  const h = hat.getBoundingClientRect(), from = { x: h.left + h.width / 2, y: h.top + h.height * .25 };
  await Promise.all(inputs.map(async (input, k) => {
    await wait(k * 260);
    hat.animate([{ transform: 'translate(-50%, -100%) scale(1)' }, { transform: 'translate(-50%, -100%) scale(1.15, .85)' }, { transform: 'translate(-50%, -100%) scale(1)' }], { duration: 220 });
    const to = center(input.getBoundingClientRect()), dx = to.x - from.x, dy = to.y - from.y;
    const bunny = document.createElement('span');
    bunny.className = 'bunny';
    bunny.textContent = input.value;
    bunny.style.left = from.x + 'px';
    bunny.style.top = from.y + 'px';
    host.append(bunny);
    // Trois bonds : un grand saut hors du chapeau, puis deux petits.
    const hop = (t, h) => ({ x: dx * t, y: dy * t - h });
    const pts = [hop(0, 0), hop(.25, 70), hop(.5, 30), hop(.62, 0), hop(.76, 26), hop(.88, 0), hop(.94, 10), hop(1, 0)];
    const offsets = [0, .22, .4, .52, .66, .78, .89, 1];
    await bunny.animate(pts.map((p, n) => ({
      transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px)) scale(${n === 0 ? .3 : n % 2 ? 1.08 : .94}, ${n % 2 ? .94 : 1.06})`,
      offset: offsets[n]
    })), { duration: 1000, easing: 'ease-in-out', fill: 'forwards' }).finished;
    bunny.remove();
    input.classList.remove('hiddenValue');
    input.classList.add('justSet');
  }));
  await hat.animate([
    { transform: 'translate(-50%, -100%) scale(1) rotate(0)', opacity: 1 },
    { transform: 'translate(-50%, -100%) scale(0) rotate(200deg)', opacity: 0 }
  ], { duration: 400, easing: 'ease-in', fill: 'forwards' }).finished;
  hat.remove();
}

/* ---------- 78. Abeille qui porte le pollen au permanent ---------- */

const BEE_SVG = `<svg viewBox="0 0 34 26"><g class="wings"><ellipse cx="14" cy="6" rx="6" ry="5" fill="#e8f4ff" opacity=".85"/><ellipse cx="20" cy="6.5" rx="5" ry="4.2" fill="#e8f4ff" opacity=".85"/></g><ellipse cx="16" cy="15" rx="11" ry="8" fill="#ffc83f"/><path d="M12 7.6c-1.5 2.5-1.5 12 0 14.8M17.5 7c-1.7 3-1.7 13 0 16" stroke="#2b2b2b" stroke-width="2.6" fill="none"/><circle cx="27.5" cy="13.5" r="4.5" fill="#2b2b2b"/><circle cx="29" cy="12.5" r="1.1" fill="#fff"/><path d="M5 15l-4 1" stroke="#2b2b2b" stroke-width="1.6" stroke-linecap="round"/><circle class="pollen" cx="16" cy="24.5" r="2.6" fill="#ffe27a" stroke="#f2b632" stroke-width=".8"/></svg>`;

let beeFlying = false;
/** Une abeille butine `fromEl`, puis vole déposer son pollen sur `toEl`. */
export async function bee(fromEl, toEl) {
  if (!motionOK() || beeFlying || !fromEl || !toEl) return;
  beeFlying = true;
  const a = center(fromEl.getBoundingClientRect()), b = center(toEl.getBoundingClientRect());
  const el = document.createElement('span');
  el.className = 'bee';
  el.innerHTML = BEE_SVG;
  el.style.left = a.x + 'px';
  el.style.top = a.y + 'px';
  fxLayer().append(el);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, px = -dy / len, py = dx / len;
  const flip = dx < 0 ? -1 : 1;
  // Butine : petits tours sur place, puis vol en zigzag avec une boucle.
  const frames = [{ transform: `translate(-50%, -50%) scale(${.3 * flip}, .3)`, opacity: 0, offset: 0 }];
  for (let s = 1; s <= 6; s++) frames.push({ transform: `translate(calc(-50% + ${Math.cos(s * 1.4) * 14}px), calc(-50% + ${Math.sin(s * 1.4) * 8}px)) scale(${flip}, 1)`, opacity: 1, offset: s * .045 });
  for (let s = 1; s <= 16; s++) {
    const t = s / 16, side = Math.sin(t * Math.PI * 3) * 28 * (1 - t);
    const loop = t > .4 && t < .55 ? Math.sin((t - .4) / .15 * Math.PI * 2) * 22 : 0;
    frames.push({ transform: `translate(calc(-50% + ${dx * t + px * side + loop}px), calc(-50% + ${dy * t + py * side - Math.abs(loop)}px)) scale(${flip}, 1) rotate(${Math.sin(t * 20) * 8}deg)`, opacity: 1, offset: .27 + t * .73 });
  }
  await el.animate(frames, { duration: Math.min(3600, 1600 + len * 2.5), easing: 'linear', fill: 'forwards' }).finished;
  el.classList.add('delivered');
  toEl.classList.remove('pollinated');
  void toEl.offsetWidth;
  toEl.classList.add('pollinated');
  setTimeout(() => toEl.classList.remove('pollinated'), 1200);
  await el.animate([
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${flip}, 1)`, opacity: 1 },
    { transform: `translate(calc(-50% + ${dx + 140}px), calc(-50% + ${dy - 180}px)) scale(${.6 * flip}, .6)`, opacity: 0 }
  ], { duration: 1100, easing: 'ease-in', fill: 'forwards' }).finished;
  el.remove();
  beeFlying = false;
}

/* ---------- 81. Fourmis qui emportent (ou rapportent) les horaires ---------- */

const ANT_SVG = `<svg viewBox="0 0 30 16"><g class="legs legsA" stroke="#3b2a20" stroke-width="1.3" stroke-linecap="round"><path d="M10 10l-3 5M17 10l0 5.5M22 10l3 5"/></g><g class="legs legsB" stroke="#3b2a20" stroke-width="1.3" stroke-linecap="round"><path d="M10 10l3 5M17 10l-3 5.5M22 10l-2 5"/></g><ellipse cx="8" cy="9" rx="6" ry="4.2" fill="#4a3428"/><ellipse cx="17" cy="9.2" rx="3.6" ry="3" fill="#4a3428"/><circle cx="24" cy="8" r="3.4" fill="#4a3428"/><path d="M26 5.5c1.5-2 3-3 3.5-3.5M25 5c.5-2 1.5-3.5 2-4" stroke="#3b2a20" stroke-width="1" fill="none" stroke-linecap="round"/><circle cx="25.4" cy="7.3" r=".8" fill="#fff"/></svg>`;

/**
 * Une colonne de fourmis traverse le bas de l'écran en portant `labels`.
 * `back` : elles les rapportent, en marche arrière, de droite à gauche.
 */
export function ants(labels, back = false) {
  if (!motionOK() || !labels.length) return;
  const host = fxLayer(), y = innerHeight - 175, gap = 64, w = innerWidth;
  labels.forEach((label, k) => {
    const ant = document.createElement('span');
    ant.className = 'ant' + (back ? ' back' : '');
    ant.innerHTML = '<span class="load">' + label + '</span>' + ANT_SVG;
    ant.style.top = y + 'px';
    host.append(ant);
    const start = back ? w + 40 : -60, end = back ? -60 : w + 40;
    ant.animate([{ transform: `translateX(${start}px)` }, { transform: `translateX(${end}px)` }], {
      duration: (w + 100) * 5.5, delay: k * gap * 5.5, easing: 'linear', fill: 'both'
    }).onfinish = () => ant.remove();
  });
}

/* ---------- 85. Secouer le téléphone : les fleurs tombent puis repoussent ---------- */

export function shakeFlowers() {
  if (!motionOK()) return;
  navigator.vibrate?.(60);
  document.body.classList.remove('shaking');
  void document.body.offsetWidth;
  document.body.classList.add('shaking');
  setTimeout(() => document.body.classList.remove('shaking'), 4200);
  const top = { getBoundingClientRect: () => ({ left: 0, right: innerWidth, top: -10, bottom: 50, height: 60 }) };
  petals(top, 'bloom', 50);
}

export const motionNeedsPermission = () => typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function';
export async function requestMotionPermission() {
  try { return (await DeviceMotionEvent.requestPermission()) === 'granted'; } catch (e) { return false; }
}

/** Appelle `onShake` quand on secoue franchement le téléphone (plusieurs à-coups rapprochés). */
export function listenShake(onShake) {
  let prev = null, hits = 0, lastHit = 0, lastShake = 0;
  window.addEventListener('devicemotion', e => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    if (prev) {
      const jolt = Math.abs(a.x - prev.x) + Math.abs(a.y - prev.y) + Math.abs(a.z - prev.z), now = Date.now();
      if (jolt > 28) {
        hits = now - lastHit < 700 ? hits + 1 : 1;
        lastHit = now;
        if (hits >= 3 && now - lastShake > 4500) { hits = 0; lastShake = now; onShake(); }
      }
    }
    prev = { x: a.x, y: a.y, z: a.z };
  });
}

/* ---------- 86. Soleil qu'on touche 10 fois : il tombe, roule et remonte penaud ---------- */

export function initSun(sun) {
  let taps = 0, last = 0, busy = false;
  sun.addEventListener('click', async () => {
    if (busy || !motionOK()) return;
    const now = Date.now();
    taps = now - last < 1500 ? taps + 1 : 1;
    last = now;
    if (taps < 10) {
      sun.classList.remove('poked');
      void sun.offsetWidth;
      sun.classList.add('poked');
      return;
    }
    taps = 0;
    busy = true;
    await sunFall(sun);
    busy = false;
  });
}

async function sunFall(sun) {
  const r = sun.getBoundingClientRect(), size = r.width;
  const clone = sun.cloneNode(true);
  clone.removeAttribute('id');
  clone.className = 'sunDeco fallingSun';
  clone.style.left = r.left + 'px';
  clone.style.top = r.top + 'px';
  fxLayer().append(clone);
  sun.style.visibility = 'hidden';
  const dy = innerHeight - r.bottom - 12, dx = 16 - r.left, turns = dx / (size / 2) * 57.3;
  const at = (x, y, rot, extra = '') => `translate(${x}px, ${y}px) rotate(${rot}deg) ${extra}`;
  // Chute avec rebonds
  await clone.animate([
    { transform: at(0, 0, -10), easing: 'ease-in' },
    { transform: at(0, dy, 40), offset: .55, easing: 'ease-out' },
    { transform: at(0, dy - 70, 70), offset: .72, easing: 'ease-in' },
    { transform: at(0, dy, 95), offset: .86, easing: 'ease-out' },
    { transform: at(0, dy - 18, 105), offset: .93, easing: 'ease-in' },
    { transform: at(0, dy, 110, 'scale(1.1, .9)') }
  ], { duration: 1500, fill: 'forwards' }).finished;
  // Roule jusqu'au bord gauche
  await clone.animate([
    { transform: at(0, dy, 110) },
    { transform: at(dx, dy, 110 + turns) }
  ], { duration: 1600, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' }).finished;
  // Reste un instant, un peu sonné, puis remonte tout penaud
  clone.classList.add('sheepish');
  await clone.animate([
    { transform: at(dx, dy, 110 + turns) },
    { transform: at(dx, dy, 120 + turns) },
    { transform: at(dx, dy, 100 + turns) },
    { transform: at(dx, dy, 110 + turns) }
  ], { duration: 700, fill: 'forwards' }).finished;
  const climb = [];
  for (let s = 0; s <= 10; s++) {
    const t = s / 10;
    climb.push({ transform: at(dx * (1 - t) + Math.sin(t * Math.PI * 4) * 10, dy * (1 - t), (110 + turns) * (1 - t) - 10 * t, `scale(${1 - Math.sin(t * Math.PI) * .25})`) });
  }
  await clone.animate(climb, { duration: 2600, easing: 'ease-in-out', fill: 'forwards' }).finished;
  clone.remove();
  sun.style.visibility = '';
  sun.classList.remove('poked');
  sun.classList.add('shy');
  setTimeout(() => sun.classList.remove('shy'), 2200);
}

/* ---------- Bon week-end : un biplan tire une banderole à travers l'écran ---------- */

const PLANE_SVG = `<svg class="planeBody" viewBox="0 0 74 44" aria-hidden="true">
  <g class="prop"><ellipse cx="5" cy="23" rx="2.2" ry="13" fill="#6f6257" opacity=".55"/></g>
  <path d="M7 19.5h5v7H7z" fill="#5a5a5a"/>
  <path d="M12 16c10-3 36-1.5 45 2l8-9.5 3.5 1.5-4.5 13c-9 4.5-40 5.5-52 3.5z" fill="#f07a8e"/>
  <path d="M14 22.5c12 1 30 .5 47-2" stroke="#fff" stroke-width="1.6" opacity=".7" fill="none"/>
  <rect x="21" y="6" width="22" height="4" rx="2" fill="#ffc83f"/>
  <rect x="19" y="29" width="26" height="4.2" rx="2.1" fill="#ffc83f"/>
  <path d="M26 10v6M38 10v6M26 25v4M38 25v4" stroke="#6f6257" stroke-width="1.4"/>
  <circle cx="33" cy="14" r="5.2" fill="#ffc83f"/>
  <g stroke="#ffc83f" stroke-width="1.4" stroke-linecap="round"><path d="M33 6.2v1.6M27 9l1.1 1.1M39 9l-1.1 1.1"/></g>
  <path d="M28.6 13h3.6c0 1.8-.7 2.8-1.8 2.8s-1.8-1-1.8-2.8zM33.6 13h3.6c0 1.8-.7 2.8-1.8 2.8s-1.8-1-1.8-2.8z" fill="#2b2b2b"/>
  <path d="M28.5 13h8.8" stroke="#2b2b2b" stroke-width=".9"/>
  <path d="M31 17.2c1 .9 2.4.9 3.4 0" stroke="#b5532c" stroke-width=".9" fill="none" stroke-linecap="round"/>
  <circle cx="22" cy="35.5" r="3" fill="#3a3440"/><path d="M22 33v-3" stroke="#6f6257" stroke-width="1.4"/>
</svg>`;

let planeFlying = false;
/** Un biplan piloté par le soleil traverse le haut de l'écran avec une banderole `message`. */
export function weekendPlane(message, card) {
  if (!motionOK() || planeFlying) return false;
  planeFlying = true;
  const plane = document.createElement('div');
  plane.className = 'weekendPlane';
  plane.innerHTML = PLANE_SVG + '<span class="rope"></span><span class="banner"></span>';
  plane.querySelector('.banner').textContent = message;
  fxLayer().append(plane);
  // L'avion survole la carte du vendredi (ou le haut de l'écran si elle n'est pas visible).
  const r = card?.getBoundingClientRect(), h = plane.offsetHeight;
  const onScreen = r && r.bottom > 0 && r.top < innerHeight;
  const y = onScreen ? r.top + Math.min(r.height * .4, 70) - h / 2 : Math.min(90, innerHeight * .12);
  plane.style.top = Math.max(8, Math.min(innerHeight - h - 8, y)) + 'px';
  const width = plane.offsetWidth, distance = innerWidth + width + 40, duration = Math.max(5200, distance * 7);
  // Le biplan entre par la droite, ondule et ressort par la gauche.
  const frames = [];
  for (let s = 0; s <= 12; s++) {
    const t = s / 12;
    frames.push({ transform: `translate(${innerWidth + 20 - distance * t}px, ${Math.sin(t * Math.PI * 3) * 14}px) rotate(${Math.cos(t * Math.PI * 3) * -3}deg)` });
  }
  plane.animate(frames, { duration, easing: 'linear', fill: 'both' }).onfinish = () => { plane.remove(); planeFlying = false; };
  // Au passage au milieu de l'écran : pluie de pétales et la carte du vendredi saute de joie.
  setTimeout(() => {
    petals(plane.querySelector('.banner'), 'bloom', 26);
    petals(plane.querySelector('.banner'), 'half', 10);
    if (card) {
      card.classList.remove('cheers');
      void card.offsetWidth;
      card.classList.add('cheers');
      setTimeout(() => card.classList.remove('cheers'), 1200);
    }
  }, duration * (innerWidth / 2 + width * .6) / distance);
  return true;
}

/* ---------- Seau d'eau qui arrose l'heure de fin pour faire pousser un JHV ---------- */

const BUCKET_SVG = `<svg viewBox="0 0 48 44" aria-hidden="true">
  <path d="M8 14C8-2 40-2 40 14" stroke="#7d8a92" stroke-width="2.4" fill="none"/>
  <path d="M6 14h36l-4 27a3 3 0 0 1-3 2.5H13a3 3 0 0 1-3-2.5z" fill="#a9cbe0"/>
  <path d="M6 14h36l-.8 5H6.8z" fill="#86b1ca"/>
  <ellipse cx="24" cy="14" rx="18" ry="4" fill="#5fb4e6"/>
  <ellipse cx="24" cy="14" rx="18" ry="4" fill="none" stroke="#6f93a8" stroke-width="2"/>
  <path d="M11 25h26M12.5 34h23" stroke="#8fb5cb" stroke-width="1.6"/>
  <circle cx="7" cy="15" r="1.8" fill="#6f93a8"/><circle cx="41" cy="15" r="1.8" fill="#6f93a8"/>
  <path d="M31 21c2 .5 3 4.5 2.4 9" stroke="#fff" stroke-width="2" opacity=".55" fill="none" stroke-linecap="round"/>
</svg>`;

const TILT = -75; // inclinaison du seau pendant l'arrosage (degrés)
const frame = () => new Promise(r => requestAnimationFrame(r));
const easeInOut = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

let bucketBusy = false;
/**
 * Un seau d'eau part de `fromEl`, file vers le champ `targetEl` (la page défile jusqu'à
 * sa journée), puis l'arrose. `onPour()` est appelé pendant l'arrosage et peut renvoyer
 * une promesse ; le seau repart une fois l'arrosage et `onPour` terminés.
 */
export async function waterBucket(fromEl, targetEl, onPour) {
  if (!motionOK() || bucketBusy || !targetEl) { await onPour(); return; }
  bucketBusy = true;
  const a = fromEl.getBoundingClientRect();
  const start = {
    x: Math.max(30, Math.min(innerWidth - 30, a.left + a.width / 2)),
    y: Math.max(30, Math.min(innerHeight - 30, a.top + a.height / 2))
  };
  const el = document.createElement('span');
  el.className = 'bucket';
  el.innerHTML = '<span class="pail">' + BUCKET_SVG + '</span>';
  fxLayer().append(el);
  const pail = el.firstChild;
  const place = (x, y) => { el.style.transform = `translate(${x - 24}px, ${y - 22}px)`; };
  // Position du seau pour que son bec, une fois incliné, tombe au-dessus du champ.
  const pourPos = () => {
    const r = targetEl.getBoundingClientRect();
    return { x: r.left + r.width / 2 + 20, y: r.top - 38 };
  };
  place(start.x, start.y);
  targetEl.closest('.day')?.scrollIntoView({ block: 'center', behavior: 'smooth' });

  // 1. Le seau apparaît puis vole en arc vers la journée, en suivant le défilement.
  const pop = pail.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1 }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out', fill: 'forwards' });
  await pop.finished;
  pop.cancel(); // laisse la main au style en ligne pendant le vol
  const duration = 1500, t0 = performance.now();
  for (let t = 0; t < 1;) {
    await frame();
    t = Math.min(1, (performance.now() - t0) / duration);
    const e = easeInOut(t), p = pourPos();
    place(start.x + (p.x - start.x) * e, start.y + (p.y - start.y) * e - Math.sin(Math.PI * t) * 70);
    pail.style.transform = `rotate(${Math.sin(t * Math.PI * 4) * 9 * (1 - t)}deg)`;
  }

  // 2. Il s'incline et arrose l'heure de fin.
  await pail.animate([{ transform: 'rotate(0)' }, { transform: `rotate(${TILT}deg)` }], { duration: 420, easing: 'ease-in-out', fill: 'forwards' }).finished;
  targetEl.classList.add('watered');
  let pouring = true;
  const follow = (async () => {
    let lastDrop = 0;
    while (pouring) {
      await frame();
      const p = pourPos();
      place(p.x, p.y);
      const now = performance.now();
      if (now - lastDrop > 38) { lastDrop = now; drop(p, targetEl.getBoundingClientRect()); }
    }
  })();
  await Promise.all([wait(1300), Promise.resolve(onPour())]);
  pouring = false;
  await follow;
  setTimeout(() => targetEl.classList.remove('watered'), 900);

  // 3. Il se redresse et s'envole.
  const p = pourPos();
  await pail.animate([{ transform: `rotate(${TILT}deg)` }, { transform: 'rotate(10deg)' }], { duration: 380, easing: 'ease-out', fill: 'forwards' }).finished;
  await el.animate([
    { transform: `translate(${p.x - 24}px, ${p.y - 22}px)`, opacity: 1 },
    { transform: `translate(${p.x + 90}px, ${p.y - 160}px) scale(.5)`, opacity: 0 }
  ], { duration: 700, easing: 'ease-in', fill: 'forwards' }).finished;
  el.remove();
  bucketBusy = false;
}

/** Une goutte quitte le bec du seau (placé en `p`) et éclabousse le champ `r`. */
function drop(p, r) {
  // Bec du seau incliné : environ 12 px à gauche et 15 px sous son centre.
  const x0 = p.x - 12 + rand(-2, 2), y0 = p.y + 15;
  const x1 = rand(r.left + r.width * .25, r.left + r.width * .75), y1 = r.top + rand(4, r.height * .6);
  const d = document.createElement('span');
  d.className = 'waterDrop';
  d.style.left = x0 + 'px';
  d.style.top = y0 + 'px';
  fxLayer().append(d);
  d.animate([
    { transform: 'translate(-50%, -50%) scale(.6)', opacity: .9 },
    { transform: `translate(calc(-50% + ${x1 - x0}px), calc(-50% + ${y1 - y0}px)) scale(1, 1.3)`, opacity: 1, offset: .85 },
    { transform: `translate(calc(-50% + ${x1 - x0 + rand(-10, 10)}px), calc(-50% + ${y1 - y0 - 4}px)) scale(1.8, .3)`, opacity: 0 }
  ], { duration: rand(380, 520), easing: 'cubic-bezier(.5, 0, 1, 1)', fill: 'forwards' }).onfinish = () => d.remove();
}
