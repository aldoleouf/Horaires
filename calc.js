// Logique de calcul des horaires et des compteurs, sans accès au DOM.

export const STORAGE_KEY = 'horaires-data-v1';
export const CUMUL_CAP = 120; // plafond du cumul : +2 h
export const DEFAULT_TARGET = 462; // 7 h 42
export const FIRST_WEEK = '0000-01-01'; // réglages valables « depuis le début »
export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

const TIME_RE = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
export const isValidTime = v => TIME_RE.test(v);

/* ---------- Dates et formats ---------- */

export function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function keyDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function fmtDate(d, withYear = false) {
  return new Intl.DateTimeFormat('fr-FR', withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }).format(d);
}

export function fmtMinutes(n) {
  const sign = n < 0 ? '−' : n > 0 ? '+' : '';
  n = Math.round(Math.abs(n));
  return sign + Math.floor(n / 60) + ' h' + (n % 60 ? String(n % 60).padStart(2, '0') : '');
}

export function fmtJhv(n) {
  return (n > 0 ? '+' : n < 0 ? '−' : '') + String(Math.abs(n));
}

export function targetLabel(target) {
  return Math.floor(target / 60) + ' h' + (target % 60 ? String(target % 60).padStart(2, '0') : '');
}

export function minutesToTime(n) {
  n = Math.max(0, Math.round(n));
  return String(Math.floor(n / 60) % 24).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}

export function timeToMinutes(v) {
  const [h, m] = String(v || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesBetween(a, b) {
  if (!a || !b) return 0;
  let v = timeToMinutes(b) - timeToMinutes(a);
  if (v < 0) v += 1440;
  return v;
}

/* ---------- Valeurs par défaut et normalisation ---------- */

export function defaultHours(i) {
  return i < 4 ? { start: '07:00', end: '16:20', break: 30 } : { start: '07:00', end: '12:00', break: 0 };
}

export function defaultSettings() {
  return { from: FIRST_WEEK, targetMinutes: DEFAULT_TARGET, is80Percent: false, reducedDay: 4 };
}

export function emptyState() {
  return { weeks: {}, adjustments: [], usualHours: [0, 1, 2, 3, 4].map(defaultHours), settingsHistory: [defaultSettings()] };
}

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

export function normalizeSettings(s, from) {
  s = s || {};
  return {
    from: typeof (from ?? s.from) === 'string' ? (from ?? s.from) : FIRST_WEEK,
    targetMinutes: clampInt(s.targetMinutes || DEFAULT_TARGET, 1, 1440, DEFAULT_TARGET),
    is80Percent: !!s.is80Percent,
    reducedDay: clampInt(s.reducedDay ?? 4, 0, 4, 4)
  };
}

function normalizeHours(h, i) {
  const def = defaultHours(i);
  h = h || {};
  return {
    start: isValidTime(h.start) ? h.start : def.start,
    end: isValidTime(h.end) ? h.end : def.end,
    break: Math.max(0, Number(h.break) || 0)
  };
}

function normalizeDay(d, i) {
  const day = { ...normalizeHours(d, i), absence: !!(d && d.absence), absHalf: !!(d && d.absHalf) };
  // Absence posée automatiquement depuis l'app Congés (« Je suis Aldo »).
  if (d && (d.conges === 'full' || d.conges === 'half')) day.conges = d.conges;
  // Jour férié posé automatiquement, ou dont l'absence a été annulée à la main.
  if (d && d.ferie) day.ferie = true;
  if (d && d.ferieOff) day.ferieOff = true;
  return day;
}

/**
 * Valide et complète des données brutes (localStorage ou sauvegarde importée,
 * toutes versions). Lève une erreur si le format n'est pas reconnu.
 */
export function normalizeState(raw) {
  const v = raw && raw.state ? raw.state : raw;
  if (!v || typeof v.weeks !== 'object' || v.weeks === null || !Array.isArray(v.adjustments)) {
    throw new Error('Format non reconnu');
  }
  const state = emptyState();

  // Réglages : historique daté, ou anciens réglages uniques (versions 1 et 2).
  let history = Array.isArray(v.settingsHistory) ? v.settingsHistory.map(s => normalizeSettings(s)) : [];
  if (!history.length) history = [normalizeSettings(v, FIRST_WEEK)];
  history.sort((a, b) => a.from.localeCompare(b.from));
  history[0].from = FIRST_WEEK;
  state.settingsHistory = history.filter((s, i) => i === history.length - 1 || s.from !== history[i + 1].from);

  if (Array.isArray(v.usualHours)) state.usualHours = [0, 1, 2, 3, 4].map(i => normalizeHours(v.usualHours[i], i));

  for (const [k, week] of Object.entries(v.weeks)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    const days = Array.isArray(week && week.days) ? week.days : [];
    state.weeks[k] = { days: [0, 1, 2, 3, 4].map(i => days[i] ? normalizeDay(days[i], i) : { ...state.usualHours[i], absence: false, absHalf: false }) };
  }

  state.adjustments = v.adjustments
    .filter(a => a && typeof a.week === 'string')
    .map(a => ({
      id: String(a.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
      week: a.week,
      label: String(a.label || 'Régularisation'),
      target: ['cumul', 'permanent', 'jhv'].includes(a.target) ? a.target : 'cumul',
      minutes: Number(a.minutes) || 0,
      days: Number(a.days) || 0
    }));

  return state;
}

/* ---------- Réglages datés ---------- */

/** Réglages en vigueur pour la semaine dont le lundi est `k`. */
export function settingsFor(state, k) {
  let current = state.settingsHistory[0];
  for (const s of state.settingsHistory) {
    if (s.from <= k) current = s;
    else break;
  }
  return current;
}

const sameSettings = (a, b) => a.targetMinutes === b.targetMinutes && a.is80Percent === b.is80Percent && a.reducedDay === b.reducedDay;

/** Applique des réglages à partir de la semaine `k` ; les semaines antérieures gardent les leurs. */
export function setSettingsFrom(state, k, values) {
  const entry = normalizeSettings(values, k);
  let history = state.settingsHistory.filter(s => s.from !== k);
  const previous = history.filter(s => s.from < k).pop();
  if (!previous || !sameSettings(previous, entry)) history.push(entry);
  history.sort((a, b) => a.from.localeCompare(b.from));
  // Supprime un changement ultérieur devenu identique au précédent.
  history = history.filter((s, i) => i === 0 || !sameSettings(s, history[i - 1]));
  history[0].from = FIRST_WEEK;
  state.settingsHistory = history;
}

export function removeSettings(state, from) {
  if (from === FIRST_WEEK) return;
  state.settingsHistory = state.settingsHistory.filter(s => s.from !== from);
}

/* ---------- Copie d'une semaine ---------- */

/**
 * Copie les horaires (début, fin, pause) de la semaine `fromKey` vers les horaires
 * habituels (`destination` = 'usual') ou vers les `count` semaines suivantes ('future').
 * Les journées d'absence et le jour non travaillé de la semaine source ne sont pas copiés ;
 * les absences déjà posées sur les semaines suivantes sont conservées.
 * Renvoie le nombre de journées copiées par semaine.
 */
export function copyWeekHours(state, fromKey, destination, count = 0) {
  const src = state.weeks[fromKey];
  if (!src) return 0;
  const set = settingsFor(state, fromKey);
  const hours = src.days.map((d, i) => d.absence || d.absHalf || isReducedDay(set, i) ? null : { start: d.start, end: d.end, break: d.break });
  if (destination === 'usual') {
    hours.forEach((h, i) => { if (h) state.usualHours[i] = { ...h }; });
  } else {
    const monday = parseKey(fromKey);
    for (let w = 1; w <= count; w++) {
      const k = keyDate(addDays(monday, 7 * w));
      if (!state.weeks[k]) state.weeks[k] = { days: state.usualHours.map(h => ({ ...h, absence: false, absHalf: false })) };
      hours.forEach((h, i) => {
        const d = state.weeks[k].days[i];
        if (h && !d.absence && !d.absHalf) Object.assign(d, h);
      });
    }
  }
  return hours.filter(Boolean).length;
}

/* ---------- Calculs ---------- */

export const isReducedDay = (set, i) => set.is80Percent && set.reducedDay === i;

export function dayWorked(d, i, set) {
  if (isReducedDay(set, i)) return 0;
  if (d.absence) return set.targetMinutes;
  return Math.max(0, minutesBetween(d.start, d.end) - Math.max(0, Number(d.break) || 0)) + (d.absHalf ? set.targetMinutes / 2 : 0);
}

export function dayDelta(d, i, set) {
  return isReducedDay(set, i) ? 0 : dayWorked(d, i, set) - set.targetMinutes;
}

export function weekTarget(set) {
  return set.targetMinutes * (set.is80Percent ? 4 : 5);
}

export function weekDelta(state, k) {
  const w = state.weeks[k];
  if (!w) return 0;
  const set = settingsFor(state, k);
  return w.days.reduce((s, d, i) => s + dayDelta(d, i, set), 0);
}

function allKeys(state) {
  return [...new Set([...Object.keys(state.weeks), ...state.adjustments.map(a => a.week)])].sort();
}

/** Soldes cumulés jusqu'à la semaine `k` incluse. */
export function computeThrough(state, k) {
  let cumul = 0, permanent = 0, jhv = 0;
  for (const wk of allKeys(state).filter(x => x <= k)) {
    const target = settingsFor(state, wk).targetMinutes;
    cumul += weekDelta(state, wk);
    for (const a of state.adjustments.filter(a => a.week === wk)) {
      if (a.target === 'cumul') cumul += a.minutes;
      else if (a.target === 'permanent') permanent += a.minutes;
      else if (a.target === 'jhv') jhv += a.days || 0;
    }
    if (cumul > CUMUL_CAP) {
      permanent += cumul - CUMUL_CAP;
      cumul = CUMUL_CAP;
    }
    if (permanent >= target) {
      const whole = Math.floor(permanent / target);
      jhv += whole;
      permanent -= whole * target;
    }
  }
  return { cumul, permanent, jhv };
}

/* ---------- Jours fériés ---------- */

/** Dimanche de Pâques (calendrier grégorien, algorithme de Meeus). */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

const feriesCache = new Map();
/** Jours fériés de France métropolitaine pour l'année `y` : Map « AAAA-MM-JJ » → nom. */
export function joursFeries(y) {
  if (!feriesCache.has(y)) {
    const p = easter(y), m = new Map();
    const fixed = [[1, 1, 'Jour de l’an'], [5, 1, 'Fête du Travail'], [5, 8, 'Victoire 1945'], [7, 14, 'Fête nationale'],
      [8, 15, 'Assomption'], [11, 1, 'Toussaint'], [11, 11, 'Armistice 1918'], [12, 25, 'Noël']];
    for (const [mo, d, name] of fixed) m.set(keyDate(new Date(y, mo - 1, d)), name);
    m.set(keyDate(addDays(p, 1)), 'Lundi de Pâques');
    m.set(keyDate(addDays(p, 39)), 'Ascension');
    m.set(keyDate(addDays(p, 50)), 'Lundi de Pentecôte');
    feriesCache.set(y, m);
  }
  return feriesCache.get(y);
}

export const ferieName = date => joursFeries(Number(date.slice(0, 4))).get(date) || '';

/* ---------- Congés (app Congés d'Aldo) ---------- */

/**
 * Transforme une liste de congés de l'app Congés en journées d'absence.
 * Renvoie une Map « AAAA-MM-JJ » → 'full' | 'half', jours ouvrés seulement.
 * Les demandes refusées sont ignorées ; deux demi-journées le même jour font une journée.
 */
export function congesDays(leaves) {
  const out = new Map();
  for (const l of Array.isArray(leaves) ? leaves : []) {
    if (!l || l.status === 'refused' || !/^\d{4}-\d{2}-\d{2}$/.test(l.start) || !/^\d{4}-\d{2}-\d{2}$/.test(l.end) || l.end < l.start) continue;
    for (let d = parseKey(l.start), n = 0; keyDate(d) <= l.end && n < 400; d = addDays(d, 1), n++) {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const k = keyDate(d);
      const half = (k === l.start && l.startPart === 'pm') || (k === l.end && l.endPart === 'am');
      const prev = out.get(k);
      out.set(k, half && prev !== 'half' && prev !== 'full' ? 'half' : 'full');
    }
  }
  return out;
}
