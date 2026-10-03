// Photick — spin the wheel for a photo topic.

import {
  applySpin, canSpin, currentTopic, dateStamp, daysBetween, emptyState, randomIndex, remaining, shuffled, wheelTopics,
} from './wheel.js';
import { createWheel } from './wheel-view.js';
import { LANGUAGES, STRINGS, initialLanguage, saveLanguage } from './i18n.js';

const WHEEL_KEY = 'photick.wheel';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  lang: initialLanguage(),
  topics: null,
  wheel: emptyState(), // { used, current, spunOn } — kept on the phone
  pool: [], // topics on the wheel right now, in wheel order
};

const t = () => STRINGS[state.lang];
const topicText = (topic) => topic?.[state.lang] ?? topic?.en ?? '';
const longDate = (date) => new Intl.DateTimeFormat(t().locale, { weekday: 'long', day: 'numeric', month: 'long' })
  .format(date).replace(/^./, (c) => c.toUpperCase());
const daysAgo = (days) => new Intl.RelativeTimeFormat(t().locale, { numeric: 'auto' }).format(-days, 'day');

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
  window.scrollTo(0, 0);
}

const current = () => document.querySelector('.screen:not([hidden])')?.id;

// ---------- saved progress ----------

function loadWheel() {
  try {
    const saved = JSON.parse(localStorage.getItem(WHEEL_KEY));
    if (saved && Array.isArray(saved.used)) return { ...emptyState(), ...saved };
  } catch {
    // nothing saved or no storage — start with a full wheel
  }
  return emptyState();
}

function saveWheel() {
  try {
    localStorage.setItem(WHEEL_KEY, JSON.stringify(state.wheel));
  } catch {
    // not remembered — the app keeps working for this session
  }
}

// ---------- language ----------

function nextLanguage() {
  return LANGUAGES[(LANGUAGES.indexOf(state.lang) + 1) % LANGUAGES.length];
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  $('spin-again').textContent = t().spinAgain;
  $('wheel-label').textContent = t().spinTitle;
  $('wheel-hint').textContent = t().spinHint;
  $('spin').textContent = t().spin;
  $('wheel-back').setAttribute('aria-label', t().back);
  const next = nextLanguage();
  for (const btn of document.querySelectorAll('.lang')) {
    btn.textContent = next.toUpperCase();
    btn.setAttribute('aria-label', STRINGS[next].switchTo);
    btn.lang = next;
  }
}

for (const btn of document.querySelectorAll('.lang')) {
  btn.addEventListener('click', () => {
    state.lang = nextLanguage();
    saveLanguage(state.lang);
    applyLanguage();
    if (current() === 'wheel-screen') renderWheel();
    else renderHome();
  });
}

// ---------- home: your topic ----------

function renderHome() {
  $('date').textContent = longDate(new Date());
  const topic = state.topics && currentTopic(state.topics, state.wheel);
  if (!topic) return;
  $('topic-label').textContent = t().yourTopic;
  $('topic').textContent = topicText(topic);
  $('topic-hint').textContent = topicText(topic.hint);

  const left = remaining(state.topics, state.wheel).length;
  const days = state.wheel.spunOn ? Math.max(0, daysBetween(state.wheel.spunOn, dateStamp())) : 0;
  $('topic-meta').textContent = `${t().drawn} ${daysAgo(days)} · ${t().left(left, state.topics.length)}`;

  const spinnable = canSpin(state.wheel);
  $('spin-again').hidden = !spinnable;
  $('next-spin').hidden = spinnable;
  $('next-spin').textContent = left === 0 ? t().lastOne : t().nextSpin;
  if (current() === 'home') fitHome();
}

// The home screen is exactly one screen tall. A long topic with its hint may not fit on a small
// phone, so the topic's font shrinks step by step until everything does (short topics stay big).
const MIN_TOPIC_PX = 28;
function fitHome() {
  const box = document.querySelector('#home .today');
  const topic = $('topic');
  topic.style.fontSize = '';
  let size = parseFloat(getComputedStyle(topic).fontSize);
  while (box.scrollHeight > box.clientHeight && size > MIN_TOPIC_PX) {
    size = Math.max(MIN_TOPIC_PX, size - 2);
    topic.style.fontSize = `${size}px`;
  }
}

// e.g. rotating the phone or the browser bar appearing.
addEventListener('resize', () => {
  if (current() === 'home') fitHome();
});

// Shows the topic, or the wheel if there's no topic yet.
function route() {
  if (state.topics && !currentTopic(state.topics, state.wheel)) return openWheel();
  show('home');
  renderHome();
}

// ---------- the wheel ----------

let lastBuzz = 0;
const wheel = createWheel($('wheel'), {
  labelOf: topicText,
  onFlick: (velocity) => spin(velocity),
  // A light tick as each topic passes the pointer (Android only; iPhone has no vibration API).
  onTick: () => {
    const now = performance.now();
    if (now - lastBuzz > 45) {
      lastBuzz = now;
      navigator.vibrate?.(4);
    }
  },
});

function renderWheel() {
  $('wheel-count').textContent = t().left(state.pool.length, state.topics.length);
  wheel.render();
}

function openWheel() {
  state.pool = shuffled(wheelTopics(state.topics, state.wheel));
  wheel.setItems(state.pool);
  $('wheel-back').hidden = !currentTopic(state.topics, state.wheel);
  $('spin').disabled = false;
  wheel.setInteractive(true);
  show('wheel-screen');
  renderWheel();
}

async function spin(velocity) {
  if (wheel.spinning || !canSpin(state.wheel) || !state.pool.length) return;
  const target = randomIndex(state.pool.length);
  state.wheel = applySpin(state.topics, state.wheel, state.pool[target].id);
  // The result counts from this moment: reloading the page mid-spin can't undo it.
  saveWheel();

  $('spin').disabled = true;
  $('wheel-back').hidden = true;
  wheel.setInteractive(false);
  await wheel.spinTo(target, velocity);
  await wait(reducedMotion() ? 200 : 900);
  route();
}

$('spin').addEventListener('click', () => spin(20 + randomIndex(12)));
$('spin-again').addEventListener('click', openWheel);
$('wheel-back').addEventListener('click', route);

// ---------- lifecycle ----------

// e.g. after midnight you can spin again.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && current() === 'home') renderHome();
});

async function init() {
  applyLanguage();
  state.wheel = loadWheel();
  renderHome();
  try {
    const res = await fetch('data/topics.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.topics = (await res.json()).topics;
    route();
  } catch (err) {
    console.error(err);
    $('topic').textContent = '—';
    $('home-note').textContent = t().loadFailed;
    $('home-note').hidden = false;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker not registered:', err));
  }
}

init();
