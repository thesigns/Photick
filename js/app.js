// Photick — spin the wheel for a photo topic, take a photo with the phone's camera, share it with the topic attached.

import {
  applySpin, canSpin, currentTopic, dateStamp, daysBetween, emptyState, randomIndex, remaining, shuffled, wheelTopics,
} from './wheel.js';
import { createWheel } from './wheel-view.js';
import { LANGUAGES, STRINGS, initialLanguage, saveLanguage } from './i18n.js';

const HASHTAG = '#photick';
const WHEEL_KEY = 'photick.wheel';

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  lang: initialLanguage(),
  topics: null,
  wheel: emptyState(), // { used, current, spunOn } — kept on the phone
  pool: [], // topics on the wheel right now, in wheel order
  photo: null, // File named after the date and topic
  url: null, // object URL of the photo for the preview
  takenAt: null,
};

const t = () => STRINGS[state.lang];
const topicText = (topic) => topic?.[state.lang] ?? topic?.en ?? '';
const longDate = (date) => new Intl.DateTimeFormat(t().locale, { weekday: 'long', day: 'numeric', month: 'long' })
  .format(date).replace(/^./, (c) => c.toUpperCase());
const shortDate = (date) => new Intl.DateTimeFormat(t().locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
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
  $('take').textContent = t().take;
  $('spin-again').textContent = t().spinAgain;
  $('wheel-label').textContent = t().spinTitle;
  $('wheel-hint').textContent = t().spinHint;
  $('spin').textContent = t().spin;
  $('retake').textContent = t().retake;
  $('cam-native').textContent = t().useCameraApp;
  $('shutter').setAttribute('aria-label', t().take);
  for (const id of ['close', 'wheel-back', 'cam-close']) $(id).setAttribute('aria-label', t().back);
  $('photo').alt = t().photoAlt;
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
  $('take').disabled = false;
}

// Shows the topic, or the wheel if there's no topic yet.
function route() {
  if (state.topics && !currentTopic(state.topics, state.wheel)) return openWheel();
  renderHome();
  show('home');
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

// ---------- photo ----------

// "Światło i cień" → "swiatlo-i-cien". NFKD splits off accents; ł has no decomposition, so it's mapped by hand.
const slug = (text) => text.toLowerCase().replace(/ł/g, 'l').replace(/['’]/g, '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function extension(file) {
  const fromType = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp' }[file.type];
  return fromType ?? file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
}

// e.g. photick-2026-10-04-solitude-in-a-crowd.jpg
function namedPhoto(file, topic, date) {
  const name = `photick-${dateStamp(date)}-${slug(topic)}.${extension(file)}`;
  return new File([file], name, { type: file.type || 'image/jpeg', lastModified: file.lastModified });
}

const caption = (topic, date) => `${topic} · Photick, ${shortDate(date)} ${HASHTAG}`;

function canShareFiles(file) {
  try {
    return !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

function openPreview(file) {
  const topic = topicText(currentTopic(state.topics, state.wheel));
  state.takenAt = new Date();
  state.photo = namedPhoto(file, topic, state.takenAt);
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = URL.createObjectURL(state.photo);

  $('photo').src = state.url;
  $('preview-date').textContent = shortDate(state.takenAt);
  $('preview-topic').textContent = topic;
  // Without a share sheet (some desktop browsers) the photo is saved instead.
  $('share').textContent = canShareFiles(state.photo) ? t().share : t().save;
  $('note').hidden = true;
  show('preview');
}

function closePreview() {
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = null;
  state.photo = null;
  $('photo').removeAttribute('src');
  route();
}

async function share() {
  const file = state.photo;
  if (!file) return;
  const topic = $('preview-topic').textContent;
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: topic, text: caption(topic, state.takenAt) });
    } catch (err) {
      // AbortError = the user closed the share sheet; that's fine.
      if (err.name !== 'AbortError') showNote(t().shareFailed);
    }
    return;
  }
  const a = document.createElement('a');
  a.href = state.url;
  a.download = file.name;
  a.click();
  showNote(t().saved(file.name));
}

function showNote(text) {
  $('note').textContent = text;
  $('note').hidden = false;
}

$('share').addEventListener('click', share);
$('close').addEventListener('click', closePreview);

// ---------- camera ----------

// Opening the phone's camera app sends the browser to the background, and on Android it's often
// killed there for lack of memory — the photo is lost ("not enough memory to complete the operation").
// Where the browser can take full-resolution photos itself (ImageCapture: Chrome on Android), the
// camera runs inside the page instead. Elsewhere (iPhone) the camera app is used; it works fine there.
const IN_APP_CAMERA = 'ImageCapture' in window && !!navigator.mediaDevices?.getUserMedia;
let stream = null;

function takePhoto() {
  if (IN_APP_CAMERA) openCamera();
  else $('camera-input').click();
}

async function openCamera() {
  show('camera');
  $('cam-topic').textContent = topicText(currentTopic(state.topics, state.wheel));
  $('cam-msg').hidden = true;
  $('shutter').disabled = true;
  try {
    // Asking for a huge size gets the largest the camera offers.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 4096 } },
    });
    if (current() !== 'camera') return stopCamera(); // the user already left
    $('video').srcObject = stream;
    await $('video').play();
    $('shutter').disabled = false;
  } catch (err) {
    console.error(err);
    stopCamera();
    $('cam-msg-text').textContent = err.name === 'NotAllowedError' ? t().cameraDenied : t().cameraFailed;
    $('cam-msg').hidden = false;
  }
}

function stopCamera() {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  $('video').srcObject = null;
}

// The current video frame, as a fallback when the camera can't take a still photo.
function videoFrame() {
  const video = $('video');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

async function capture() {
  if (!stream) return;
  $('shutter').disabled = true;
  $('flash').classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => $('flash').classList.remove('on')));

  const capturer = new ImageCapture(stream.getVideoTracks()[0]);
  let blob = null;
  try {
    // A still photo at the sensor's full resolution, not just a video frame.
    const caps = await capturer.getPhotoCapabilities();
    const size = caps.imageWidth?.max ? { imageWidth: caps.imageWidth.max, imageHeight: caps.imageHeight.max } : {};
    blob = await capturer.takePhoto(size);
  } catch (err) {
    console.warn('Full-resolution photo failed, trying the default size:', err);
    try {
      blob = await capturer.takePhoto();
    } catch (err2) {
      console.warn('Still photo failed, using a video frame:', err2);
    }
  }
  blob ??= await videoFrame();
  stopCamera();
  openPreview(new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }));
}

$('take').addEventListener('click', takePhoto);
$('retake').addEventListener('click', takePhoto);
$('shutter').addEventListener('click', capture);
$('cam-close').addEventListener('click', () => {
  stopCamera();
  route();
});
// If the in-app camera isn't allowed, the camera app is still an option.
$('cam-native').addEventListener('click', () => $('camera-input').click());
$('camera-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) openPreview(file);
});

// ---------- lifecycle ----------

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopCamera(); // the camera shouldn't run in the background
    return;
  }
  if (current() === 'home') renderHome(); // e.g. after midnight you can spin again
  if (current() === 'camera' && $('cam-msg').hidden) openCamera();
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
