// Interface de saisie : rendu, événements, sauvegarde locale.
import {
  STORAGE_KEY, FIRST_WEEK, DAY_NAMES, isValidTime,
  mondayOf, keyDate, parseKey, addDays, fmtDate, fmtMinutes, fmtJhv, targetLabel, minutesToTime, timeToMinutes,
  emptyState, normalizeState, settingsFor, setSettingsFrom, removeSettings, copyWeekHours,
  isReducedDay, dayWorked, dayDelta, weekDelta, weekTarget, computeThrough, congesDays
} from './calc.js';
import {
  motionOK, systemReducesMotion, animationsEnabled, setAnimations,
  petals, BUD_SVG, updateBud, WEATHER_HTML, updateWeather, ladybug
} from './animations.js';
import {
  SHADES_HTML, ZZZ_HTML, magicHat, bee, ants, shakeFlowers,
  listenShake, motionNeedsPermission, requestMotionPermission, initSun
} from './farces.js';

const $ = id => document.getElementById(id);
let state = emptyState();
let activeTab = 'planning';
let currentMonday = mondayOf(new Date());
const currentKey = () => keyDate(currentMonday);
let cascadeNext = true; // fait apparaître les journées en cascade au prochain rendu
let lastShown = null;
let shakeAllowed = false; // iPhone : autorisation d'utiliser les mouvements du téléphone   // soldes affichés au rendu précédent, pour animer les changements

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- Messages (remplacent alert / confirm) ---------- */

let toastTimer;
function hideToast() { $('toast').hidden = true; }
function toast(message, { error = false, action, onAction } = {}) {
  const el = $('toast');
  el.className = 'toast' + (error ? ' error' : '');
  el.textContent = '';
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'small';
    b.textContent = action;
    b.onclick = () => { hideToast(); onAction(); };
    el.append(b);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 8000 : 4500);
}

/** Exécute une modification et propose de l'annuler. */
function withUndo(message, change, onUndo) {
  const snapshot = JSON.stringify(state);
  change();
  render();
  toast(message, { action: 'Annuler', onAction: () => { state = normalizeState(JSON.parse(snapshot)); render(); onUndo?.(); } });
}

/* ---------- Stockage ---------- */

function setStatus(t) { $('status').textContent = t; }

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStatus('Enregistré automatiquement · ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
  } catch (e) {
    setStatus('Impossible d’enregistrer : exportez vos données.');
  }
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = normalizeState(JSON.parse(raw));
  } catch (e) {
    // Conserve les données illisibles plutôt que de les écraser.
    try { if (raw) localStorage.setItem(STORAGE_KEY + '-illisible-' + Date.now(), raw); } catch (_) {}
    toast('Les données enregistrées étaient illisibles ; une copie a été conservée.', { error: true });
  }
}

/* ---------- Semaines ---------- */

function freshDay(i) { return { ...state.usualHours[i], absence: false, absHalf: false }; }

function ensureWeek(k) {
  if (!state.weeks[k]) {
    state.weeks[k] = { days: [0, 1, 2, 3, 4].map(freshDay) };
    applyCongesToWeek(k);
  }
  return state.weeks[k];
}

/* ---------- Lien avec l'app Congés (« Je suis Aldo ») ---------- */
// Réglage propre à cet appareil, hors des données d'horaires : seul Aldo le coche.
// Les journées marquées automatiquement portent `conges: 'full' | 'half'`, ce qui
// permet de les retirer si le congé est supprimé ou si la case est décochée.

const ALDO_KEY = 'horaires-aldo';
const CONGES_API = 'https://conges-tan.vercel.app/api/horaires';
let aldo = { enabled: false, code: '', leaves: [], updatedAt: '', checkedAt: '', error: '', dismissed: [] };
try { aldo = { ...aldo, ...JSON.parse(localStorage.getItem(ALDO_KEY) || '{}') }; } catch (e) {}
let congesMap = new Map();

function saveAldo() {
  try { localStorage.setItem(ALDO_KEY, JSON.stringify(aldo)); } catch (e) {}
}

function refreshCongesMap() {
  congesMap = aldo.enabled ? congesDays(aldo.leaves) : new Map();
  // Oublie les refus d'absence devenus sans objet (congé supprimé ou modifié).
  aldo.dismissed = aldo.dismissed.filter(x => congesMap.get(x.split('|')[0]) === x.split('|')[1]);
}

/** Met une journée en accord avec les congés ; renvoie true si elle a changé. */
function applyCongesToDay(d, date) {
  let want = congesMap.get(date) || null;
  if (want && aldo.dismissed.includes(date + '|' + want)) want = null;
  const had = d.conges || null;
  if (had === want) return false;
  if (had) {
    // Retire l'absence posée automatiquement.
    if (had === 'full') d.absence = false; else d.absHalf = false;
    delete d.conges;
  }
  if (!want) return !!had;
  if (d.absence || (want === 'half' && d.absHalf)) return !!had; // absence déjà saisie à la main : on n'y touche pas
  if (want === 'full') { d.absence = true; d.absHalf = false; } else d.absHalf = true;
  d.conges = want;
  return true;
}

function applyCongesToWeek(k) {
  const monday = parseKey(k);
  let changed = false;
  state.weeks[k].days.forEach((d, i) => { if (applyCongesToDay(d, keyDate(addDays(monday, i)))) changed = true; });
  return changed;
}

/** Applique les congés aux semaines déjà existantes (les suivantes le seront à leur création). */
function applyConges() {
  refreshCongesMap();
  let changed = false;
  for (const k of Object.keys(state.weeks)) if (applyCongesToWeek(k)) changed = true;
  saveAldo();
  return changed;
}

async function syncConges({ quiet = true } = {}) {
  if (!aldo.enabled) return;
  const code = aldo.code.trim().toUpperCase();
  if (!code) { renderAldo(); return; }
  try {
    const r = await fetch(CONGES_API, { headers: { 'X-Sync-Code': code }, cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 404 ? 'code inconnu : activez le lien dans l’app Congés et vérifiez le code' : data.error || 'erreur ' + r.status);
    if (!aldo.enabled || aldo.code.trim().toUpperCase() !== code) return; // réglage changé entre-temps
    aldo.leaves = Array.isArray(data.leaves) ? data.leaves : [];
    aldo.updatedAt = data.updatedAt || '';
    aldo.checkedAt = new Date().toISOString();
    aldo.error = '';
    const changed = applyConges();
    render();
    if (!quiet || changed) toast(changed ? 'Planning mis à jour avec vos congés.' : 'Congés synchronisés : rien de nouveau.');
  } catch (e) {
    aldo.error = e.message === 'Failed to fetch' ? 'hors connexion' : e.message;
    saveAldo();
    renderAldo();
    if (!quiet) toast('Synchronisation impossible : ' + aldo.error + '.', { error: true });
  }
}

function renderAldo() {
  $('isAldo').checked = aldo.enabled;
  $('aldoBox').hidden = !aldo.enabled;
  if (document.activeElement !== $('aldoCode')) $('aldoCode').value = aldo.code;
  const when = iso => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  $('aldoStatus').textContent = !aldo.code.trim() ? 'Saisissez le code pour lier les deux applications.'
    : aldo.error ? '⚠️ Dernière synchronisation échouée : ' + aldo.error + '.' + (aldo.checkedAt ? ' Congés connus au ' + when(aldo.checkedAt) + '.' : '')
    : aldo.checkedAt ? 'Synchronisé le ' + when(aldo.checkedAt) + ' · ' + congesMap.size + ' jour(s) de congé connus.'
    : 'Synchronisation en cours…';
}

/* ---------- Rendu ---------- */

function setBalance(id, n, text = fmtMinutes(n), prev) {
  const el = $(id);
  el.textContent = text;
  el.className = n > 0 ? 'positive' : n < 0 ? 'negative' : '';
  updateWeather(el.closest('.stat'), n, prev);
}

function settingsSummary(s) {
  return targetLabel(s.targetMinutes) + (s.is80Percent ? ' · 80 % (' + DAY_NAMES[s.reducedDay].toLowerCase() + ' non travaillé)' : ' · 100 %');
}

function renderTabs() {
  $('settingsPanel').hidden = activeTab !== 'settings';
  $('usualPanel').hidden = activeTab !== 'usual';
  $('dayPanel').hidden = activeTab !== 'planning';
  for (const [id, tab] of [['tabPlanning', 'planning'], ['tabUsual', 'usual']]) {
    $(id).className = activeTab === tab ? 'primary' : 'outline';
    $(id).setAttribute('aria-selected', String(activeTab === tab));
  }
}

function renderSettings(k, set) {
  $('targetHours').value = Math.floor(set.targetMinutes / 60);
  $('targetMinutes').value = set.targetMinutes % 60;
  $('is80Percent').checked = set.is80Percent;
  $('reducedDay').value = String(set.reducedDay);
  $('reducedDay').disabled = !set.is80Percent;
  $('animToggle').checked = animationsEnabled();
  $('animHint').textContent = systemReducesMotion()
    ? 'Votre appareil demande de réduire les animations : elles restent désactivées.'
    : 'Journées en cascade, pétales, bourgeon, nuages, coccinelle, abeille, fourmis… et quelques surprises.';
  $('shakePermission').hidden = !motionNeedsPermission() || shakeAllowed;
  $('settingsScopeFrom').textContent = 'À partir de la semaine du ' + fmtDate(currentMonday, true);
  const host = $('settingsHistory');
  host.innerHTML = '';
  for (const s of state.settingsHistory) {
    const row = document.createElement('div');
    row.className = 'adjustment' + (s === set ? ' current' : '');
    const since = s.from === FIRST_WEEK ? 'Depuis le début' : 'Depuis le ' + fmtDate(parseKey(s.from), true);
    row.innerHTML = '<span><b>' + since + '</b><br><small>' + escapeHtml(settingsSummary(s)) + '</small></span>' +
      (s.from === FIRST_WEEK ? '' : '<button type="button" class="small" data-remove-setting="' + s.from + '" aria-label="Supprimer ce changement de réglages">×</button>');
    host.append(row);
  }
}

function timeField(id, label, attrs, value, disabled, nowButton) {
  return '<div class="field"><div class="labelrow"><label for="' + id + '">' + label + '</label>' +
    (nowButton ? '<button type="button" class="now" ' + nowButton + ' title="Mettre l’heure actuelle" aria-label="' + label + ' : mettre l’heure actuelle">⏱</button>' : '') +
    '</div><input id="' + id + '" type="time" ' + attrs + ' value="' + value + '"' + (disabled ? ' disabled' : '') + '></div>';
}

function renderDays(w, set) {
  const host = $('days');
  host.innerHTML = '';
  const now = new Date(), todayKey = keyDate(now), hour = now.getHours();
  const thisWeek = currentKey() === keyDate(mondayOf(now)), weekday = (now.getDay() + 6) % 7;
  // Vendredi après-midi (et le week-end qui suit) : la carte du vendredi se balance en hamac.
  const hammock = thisWeek && (weekday > 4 || (weekday === 4 && hour >= 12));
  w.days.forEach((d, i) => {
    const date = addDays(currentMonday, i), off = isReducedDay(set, i), delta = dayDelta(d, i, set);
    const isToday = keyDate(date) === todayKey, locked = off || d.absence;
    const el = document.createElement('article');
    el.className = 'day' + (off ? ' reducedDay' : d.absence ? ' absent' : d.absHalf ? ' halfAbsent' : '') + (isToday ? ' today' : '') + (cascadeNext ? ' enter' : '') +
      (i === 4 && hammock && !off ? ' hammock' : '') + (i === 0 && isToday && hour < 12 && !locked ? ' yawning' : '');
    el.style.setProperty('--i', i);
    const attrs = f => 'data-i="' + i + '" data-field="' + f + '"';
    const now = f => isToday && !locked ? 'data-action="now" data-i="' + i + '" data-field="' + f + '"' : '';
    let actions;
    if (off) actions = '<div class="daynote">Journée non travaillée · 80 %</div>';
    else {
      actions = (d.conges ? '<div class="daynote conges">🌴 ' + (d.conges === 'half' ? 'Demi-journée de congé' : 'Congé') + ' · app Congés</div>' : '') +
        '<div class="actions"><div class="dayworked">' + fmtMinutes(dayWorked(d, i, set)) + ' / ' + targetLabel(set.targetMinutes) + '</div>' +
        (d.absence || d.absHalf
          ? '<button type="button" class="small absence" data-action="cancelAbsence" data-i="' + i + '">Annuler absence</button>'
          : '<button type="button" class="small absence" data-action="absence" data-i="' + i + '">Abs</button>' +
            '<button type="button" class="small absenceHalf" data-action="absenceHalf" data-i="' + i + '">Abs/2</button>' +
            '<button type="button" class="small outline usualButton" data-action="reset" data-i="' + i + '">Horaires habituels</button>') +
        '</div>';
    }
    el.innerHTML = '<div class="daytop"><div><span class="dayname">' + DAY_NAMES[i] + '</span><span class="daydate">' + fmtDate(date) + '</span>' +
      (i === 4 && !off ? SHADES_HTML : '') + (i === 0 && isToday && hour < 12 && !locked ? ZZZ_HTML : '') + '</div>' +
      '<div class="dayresult ' + (delta > 0 ? 'positive' : delta < 0 ? 'negative' : '') + '">' + fmtMinutes(delta) + '</div></div>' +
      (isToday && !locked ? '<div class="growbar" data-i="' + i + '"></div>' : '') +
      '<div class="fields">' +
      timeField('day' + i + '-start', 'Début', attrs('start'), off ? '12:00' : d.start, locked, now('start')) +
      timeField('day' + i + '-end', 'Fin', attrs('end'), off ? '12:00' : d.end, locked, now('end')) +
      timeField('day' + i + '-break', 'Pause (min)', attrs('break'), off ? '00:00' : minutesToTime(d.break), locked) +
      '</div>' + actions;
    host.append(el);
  });
  cascadeNext = false;
  updateGrowbar();
}

/* Tige qui pousse de l'heure de début vers l'heure de fin sur la journée du jour */
function updateGrowbar() {
  const bar = document.querySelector('.growbar');
  if (!bar) return;
  const d = state.weeks[currentKey()].days[Number(bar.dataset.i)], n = new Date();
  const now = n.getHours() * 60 + n.getMinutes(), start = timeToMinutes(d.start);
  let end = timeToMinutes(d.end);
  if (end <= start) end += 1440;
  const ratio = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const text = now < start ? 'Début à ' + d.start
    : ratio >= 1 ? 'Journée terminée'
    : 'Encore ' + fmtMinutes(end - now).replace('+', '') + ' · fin ' + d.end;
  bar.classList.toggle('done', ratio >= 1);
  bar.title = 'Journée accomplie à ' + Math.round(ratio * 100) + ' %';
  if (!bar.firstChild) {
    bar.innerHTML = '<div class="growtrack" aria-hidden="true"><div class="growstem"></div></div><span class="growflower" aria-hidden="true">🌼</span><span class="growtext"></span>';
  }
  bar.querySelector('.growstem').style.width = (ratio * 100).toFixed(1) + '%';
  bar.querySelector('.growtext').textContent = text;
}
setInterval(updateGrowbar, 30000);

function renderUsualHours() {
  const host = $('usualHoursEditor');
  host.innerHTML = '';
  DAY_NAMES.forEach((name, i) => {
    const h = state.usualHours[i], row = document.createElement('div');
    const attrs = f => 'data-usual-i="' + i + '" data-field="' + f + '"';
    row.className = 'usualRow';
    row.innerHTML = '<div class="usualDay">' + name + '</div>' +
      timeField('usual' + i + '-start', 'Début', attrs('start'), h.start) +
      timeField('usual' + i + '-end', 'Fin', attrs('end'), h.end) +
      timeField('usual' + i + '-break', 'Pause (min)', attrs('break'), minutesToTime(h.break));
    host.append(row);
  });
}

function renderAdjustments(k) {
  const host = $('adjustments');
  host.innerHTML = '';
  const list = state.adjustments.filter(a => a.week === k);
  if (!list.length) {
    host.innerHTML = '<div class="empty">Aucune régularisation pour cette semaine.</div>';
    return;
  }
  for (const a of list) {
    const val = a.target === 'jhv' ? fmtJhv(a.days) + ' JHV' : fmtMinutes(a.minutes);
    const el = document.createElement('div');
    el.className = 'adjustment';
    el.innerHTML = '<span><b>' + escapeHtml(a.label) + '</b><br><small>' + { cumul: 'Cumul', permanent: 'Permanent', jhv: 'JHV' }[a.target] + ' · ' + a.week + '</small></span>' +
      '<span>' + val + ' <button type="button" class="small" data-remove="' + escapeHtml(a.id) + '" aria-label="Supprimer la régularisation ' + escapeHtml(a.label) + '">×</button></span>';
    host.append(el);
  }
}

function render() {
  const k = currentKey(), set = settingsFor(state, k), w = ensureWeek(k);
  renderTabs();
  if (activeTab === 'usual') renderUsualHours();
  renderSettings(k, set);
  renderAldo();

  const friday = addDays(currentMonday, 4);
  $('weekLabel').innerHTML = fmtDate(currentMonday) + ' – ' + fmtDate(friday) + (k === keyDate(mondayOf(new Date()))
    ? '<small>Semaine actuelle</small>'
    : '<button type="button" class="todayBtn" id="todayBtn">↺ Aujourd’hui</button>');
  renderCopyHint();

  const worked = w.days.reduce((s, d, i) => s + dayWorked(d, i, set), 0), bal = computeThrough(state, k), wd = weekDelta(state, k);
  // Les animations de changement ne jouent que si l'on reste sur la même semaine.
  const prev = lastShown && lastShown.k === k ? lastShown : {};
  setBalance('weekBalance', wd, undefined, prev.week);
  $('workedLabel').textContent = 'Réalisé ' + fmtMinutes(worked) + ' / objectif ' + fmtMinutes(weekTarget(set));
  setBalance('carriedBalance', bal.cumul, undefined, prev.cumul);
  setBalance('permanentBalance', bal.permanent, undefined, prev.permanent);
  setBalance('jhvBalance', bal.jhv, fmtJhv(bal.jhv), prev.jhv);
  updateBud($('permanentBalance').closest('.stat'), bal.permanent / set.targetMinutes, prev.jhv !== undefined && bal.jhv > prev.jhv);
  lastShown = { k, week: wd, cumul: bal.cumul, permanent: bal.permanent, jhv: bal.jhv };
  $('detail-permanent').textContent = 'Converti en JHV par tranche de ' + targetLabel(set.targetMinutes);
  $('detail-jhv').textContent = 'Journées de ' + targetLabel(set.targetMinutes);

  renderDays(w, set);
  renderAdjustments(k);
  save();
}

/* ---------- Événements ---------- */

document.querySelectorAll('.stat[role="button"]').forEach(card => {
  const toggle = () => {
    const detail = card.querySelector('small'), expanded = card.getAttribute('aria-expanded') === 'true';
    card.setAttribute('aria-expanded', String(!expanded));
    if (detail) detail.hidden = expanded;
  };
  card.addEventListener('click', toggle);
  card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
});

$('settingsBtn').onclick = () => { activeTab = activeTab === 'settings' ? 'planning' : 'settings'; render(); };
$('closeSettings').onclick = () => { activeTab = 'planning'; render(); };
$('tabPlanning').onclick = () => { cascadeNext = activeTab !== 'planning'; activeTab = 'planning'; render(); };
$('tabUsual').onclick = () => { activeTab = 'usual'; render(); };
$('is80Percent').onchange = e => { $('reducedDay').disabled = !e.target.checked; };
$('isAldo').onchange = e => {
  aldo.enabled = e.target.checked;
  aldo.error = '';
  applyConges(); // décoché : retire toutes les absences posées automatiquement
  render();
  if (aldo.enabled) syncConges();
  else toast('Lien avec l’app Congés désactivé : les absences automatiques ont été retirées.');
};
$('aldoCode').onchange = e => {
  aldo.code = e.target.value.trim().toUpperCase();
  aldo.checkedAt = '';
  aldo.leaves = [];
  aldo.error = '';
  applyConges();
  render();
  syncConges({ quiet: false });
};
$('aldoSync').onclick = () => {
  aldo.code = $('aldoCode').value.trim().toUpperCase();
  syncConges({ quiet: false });
};
$('shakePermission').onclick = async () => {
  shakeAllowed = await requestMotionPermission();
  $('shakePermission').hidden = shakeAllowed;
  toast(shakeAllowed ? 'Secouez le téléphone pour voir…' : 'Autorisation refusée par le téléphone.', { error: !shakeAllowed });
};
$('animToggle').onchange = e => {
  setAnimations(e.target.checked);
  toast(e.target.checked ? 'Animations activées.' : 'Animations désactivées.');
};
$('defaultSettings').onclick = () => { $('targetHours').value = 7; $('targetMinutes').value = 42; };

$('saveSettings').onclick = () => {
  const h = Number($('targetHours').value), m = Number($('targetMinutes').value), total = h * 60 + m;
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 24 || m < 0 || m > 59 || total < 1 || total > 1440) {
    toast('Saisissez une durée valide, entre 1 minute et 24 heures.', { error: true });
    return;
  }
  const values = { targetMinutes: total, is80Percent: $('is80Percent').checked, reducedDay: Number($('reducedDay').value) };
  const all = $('settingsScope').value === 'all';
  withUndo(all ? 'Réglages appliqués à toutes les semaines.' : 'Réglages appliqués à partir du ' + fmtDate(currentMonday, true) + '.', () => {
    if (all) state.settingsHistory = [{ from: FIRST_WEEK, ...values }];
    else setSettingsFrom(state, currentKey(), values);
    activeTab = 'planning';
  });
};

$('settingsHistory').addEventListener('click', e => {
  const b = e.target.closest('[data-remove-setting]');
  if (b) withUndo('Changement de réglages supprimé.', () => removeSettings(state, b.dataset.removeSetting));
});

/** Lit la valeur d'un champ horaire ; renvoie null (et affiche un message) si elle est invalide. */
function readTimeInput(el, previous) {
  if (el.dataset.field === 'break') return timeToMinutes(el.value);
  if (!isValidTime(el.value)) {
    toast('Saisissez une heure valide au format HH:MM (ex. 08:30).', { error: true });
    el.value = previous;
    return null;
  }
  return el.value;
}

$('usualHoursEditor').addEventListener('change', e => {
  const el = e.target;
  if (!el.dataset.usualI) return;
  const h = state.usualHours[Number(el.dataset.usualI)], v = readTimeInput(el, h[el.dataset.field]);
  if (v === null) return;
  h[el.dataset.field] = v;
  render();
});

$('days').addEventListener('change', e => {
  const el = e.target;
  if (!el.dataset.field) return;
  const i = Number(el.dataset.i), d = ensureWeek(currentKey()).days[i], v = readTimeInput(el, d[el.dataset.field]);
  if (v === null) return;
  const set = settingsFor(state, currentKey()), before = dayDelta(d, i, set);
  d[el.dataset.field] = v;
  render();
  // Journée qui gagne du temps en positif : une abeille en porte le pollen au permanent.
  const after = dayDelta(d, i, set);
  if (after > 0 && after > before) beeToPermanent($('days').children[i]);
});

function beeToPermanent(card) {
  bee(card?.querySelector('.dayresult'), $('permanentBalance').closest('.stat').querySelector('.budWrap'));
}

$('days').addEventListener('click', e => {
  const b = e.target.closest('button[data-action]');
  if (!b) return;
  const i = Number(b.dataset.i), d = ensureWeek(currentKey()).days[i], set = settingsFor(state, currentKey());
  switch (b.dataset.action) {
    case 'absence':
      d.absence = true;
      d.absHalf = false;
      d.start = '07:00';
      d.end = minutesToTime(set.targetMinutes / 2);
      d.break = 0;
      break;
    case 'absenceHalf':
      d.absHalf = true;
      d.absence = false;
      break;
    case 'cancelAbsence':
      if (d.conges) {
        aldo.dismissed.push(keyDate(addDays(currentMonday, i)) + '|' + d.conges);
        saveAldo();
        delete d.conges;
      }
      d.absence = false;
      d.absHalf = false;
      break;
    case 'reset': {
      Object.assign(d, freshDay(i));
      render();
      const card = $('days').children[i];
      magicHat(card.querySelector('[data-action=reset]'), [...card.querySelectorAll('.fields input')]);
      return;
    }
    case 'now': {
      if (b.disabled) return;
      b.disabled = true; // un seul trajet de coccinelle à la fois
      const field = b.dataset.field, id = 'day' + i + '-' + field;
      ladybug(b, $(id), () => {
        const n = new Date();
        d[field] = minutesToTime(n.getHours() * 60 + n.getMinutes());
        render();
        const input = $(id);
        input.focus();
        if (motionOK()) input.classList.add('justSet');
        toast((field === 'start' ? 'Début' : 'Fin') + ' réglé sur ' + d[field] + '.');
      });
      return;
    }
  }
  render();
  if (b.dataset.action === 'absence' || b.dataset.action === 'absenceHalf') {
    petals($('days').children[i], b.dataset.action === 'absence' ? 'absence' : 'half');
  }
});

$('prev').onclick = () => { currentMonday = addDays(currentMonday, -7); cascadeNext = true; render(); };
$('next').onclick = () => { currentMonday = addDays(currentMonday, 7); cascadeNext = true; render(); };

function scrollToToday() {
  requestAnimationFrame(() => document.querySelector('.day.today')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
}
$('weekLabel').addEventListener('click', e => {
  if (!e.target.closest('#todayBtn')) return;
  currentMonday = mondayOf(new Date());
  activeTab = 'planning';
  cascadeNext = true;
  render();
  $('next').focus();
  scrollToToday();
});

/* Copie de la semaine affichée */
function copyWeekCount() {
  return Math.max(1, Math.min(52, Math.round(Number($('copyWeeks').value)) || 1));
}
function renderCopyHint() {
  const future = $('copyTarget').value === 'future';
  $('copyWeeksField').hidden = !future;
  if (!future) {
    $('copyHint').textContent = 'Les journées déjà saisies ne sont pas modifiées ; les nouvelles semaines utiliseront ces horaires.';
    return;
  }
  const n = copyWeekCount(), first = addDays(currentMonday, 7), last = addDays(currentMonday, 7 * n + 4);
  $('copyHint').textContent = 'Remplace les horaires du ' + fmtDate(first, true) + ' au ' + fmtDate(last, true) +
    '. Les absences déjà posées et les régularisations sont conservées.';
}
$('copyWeekBtn').onclick = () => {
  const open = $('copyPanel').hidden;
  $('copyPanel').hidden = !open;
  $('copyWeekBtn').setAttribute('aria-expanded', String(open));
  renderCopyHint();
};
$('copyTarget').onchange = renderCopyHint;
$('copyWeeks').oninput = renderCopyHint;
$('copyApply').onclick = () => {
  const destination = $('copyTarget').value, n = copyWeekCount();
  let copied = 0;
  withUndo(destination === 'usual'
    ? 'Horaires de la semaine copiés dans les horaires habituels.'
    : 'Horaires copiés sur ' + (n === 1 ? 'la semaine suivante.' : 'les ' + n + ' semaines suivantes.'), () => {
    copied = copyWeekHours(state, currentKey(), destination, n);
  });
  if (!copied) toast('Aucune journée à copier : toute la semaine est en absence.', { error: true });
  $('copyPanel').hidden = true;
  $('copyWeekBtn').setAttribute('aria-expanded', 'false');
};

$('adjTarget').onchange = e => {
  const isJhv = e.target.value === 'jhv';
  $('adjHours').placeholder = isJhv ? 'Ex. 1 ou -0.5' : 'Ex. 2.25';
  $('adjustHint').textContent = isJhv
    ? 'Pour JHV, saisissez un nombre de jours (ex. 1 ou -0,5). Pour les autres compteurs, saisissez un nombre d’heures (ex. 2,25).'
    : 'La régularisation du cumul ne peut dépasser +2 h : tout surplus est automatiquement transféré au permanent.';
};

$('addAdjustment').onclick = () => {
  const raw = Number($('adjHours').value), label = $('adjLabel').value.trim() || 'Régularisation', target = $('adjTarget').value;
  if (!Number.isFinite(raw) || raw === 0) {
    toast('Saisissez une valeur non nulle.', { error: true });
    $('adjHours').focus();
    return;
  }
  state.adjustments.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    week: currentKey(), label, target,
    minutes: target === 'jhv' ? 0 : Math.round(raw * 60),
    days: target === 'jhv' ? raw : 0
  });
  $('adjHours').value = '';
  $('adjLabel').value = '';
  render();
  toast('Régularisation ajoutée.');
};

$('adjustments').addEventListener('click', e => {
  const b = e.target.closest('[data-remove]');
  if (b) withUndo('Régularisation supprimée.', () => { state.adjustments = state.adjustments.filter(a => a.id !== b.dataset.remove); });
});

$('resetWeek').onclick = () => {
  // Les fourmis emportent les horaires de la semaine… et les rapportent si on annule.
  const k = currentKey(), labels = [];
  ensureWeek(k).days.forEach(d => { if (!d.absence) labels.push(d.start, d.end); });
  state.adjustments.filter(a => a.week === k).forEach(a => labels.push(a.label.slice(0, 12)));
  const load = labels.slice(0, 12);
  withUndo('Semaine vidée : horaires habituels rétablis et régularisations supprimées.', () => {
    state.weeks[k] = { days: [0, 1, 2, 3, 4].map(freshDay) };
    applyCongesToWeek(k);
    state.adjustments = state.adjustments.filter(a => a.week !== k);
  }, () => ants(load.slice().reverse(), true));
  ants(load);
};

$('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url;
  a.download = 'horaires-sauvegarde-' + keyDate(new Date()) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Sauvegarde exportée.');
};

$('importBtn').onclick = () => $('importFile').click();
$('importFile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let imported;
  try {
    imported = normalizeState(JSON.parse(await f.text()));
  } catch (err) {
    toast('Fichier invalide ou format non reconnu.', { error: true });
    return;
  }
  withUndo('Sauvegarde importée : les données précédentes ont été remplacées.', () => { state = imported; applyConges(); });
};

/* ---------- Démarrage ---------- */

document.querySelectorAll('.stat').forEach(card => card.insertAdjacentHTML('beforeend', WEATHER_HTML));
$('permanentBalance').closest('.stat').insertAdjacentHTML('beforeend', '<span class="budWrap">' + BUD_SVG + '</span>');

initSun($('sunDeco'));
listenShake(shakeFlowers);

load();
if (aldo.enabled) applyConges();
render();
syncConges();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncConges(); });
scrollToToday();
// Au démarrage, une abeille butine une journée positive de la semaine.
setTimeout(() => {
  const positive = [...document.querySelectorAll('#days .day .dayresult.positive')];
  if (positive.length) beeToPermanent(positive[Math.floor(Math.random() * positive.length)].closest('.day'));
}, 1600);
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
