// The wheel: each spin draws one random topic from those not drawn yet in this round.
// Once every topic has been drawn, the wheel is full again. One spin per calendar day;
// the drawn topic stays until the next spin, however many days later that is.
// Pure functions without the DOM, so they can also run in Node.

export const emptyState = () => ({ used: [], current: null, spunOn: null });

// Local date as YYYY-MM-DD (toISOString would use UTC and could give yesterday's date).
export function dateStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Whole days between two YYYY-MM-DD stamps.
export function daysBetween(from, to) {
  const utc = (s) => Date.UTC(...s.split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)));
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export const canSpin = (state, today = dateStamp()) => state.spunOn !== today;

export const currentTopic = (topics, state) => topics.find((t) => t.id === state.current) ?? null;

// Ids drawn in this round that are still on the list (a topic may have been deleted since).
const usedIds = (topics, state) => new Set(state.used.filter((id) => topics.some((t) => t.id === id)));

// Topics still on the wheel in this round. The current topic is never on it.
export function remaining(topics, state) {
  const used = usedIds(topics, state);
  return topics.filter((t) => !used.has(t.id) && t.id !== state.current);
}

// What the next spin can land on: the rest of this round, or — once it's used up —
// a full wheel again (still without the current topic, so it can't come up twice in a row).
export function wheelTopics(topics, state) {
  const rest = remaining(topics, state);
  if (rest.length) return rest;
  const full = topics.filter((t) => t.id !== state.current);
  return full.length ? full : topics;
}

// The state after a spin that landed on `topicId`.
export function applySpin(topics, state, topicId, today = dateStamp()) {
  const newRound = remaining(topics, state).length === 0;
  const used = newRound ? [] : [...usedIds(topics, state)];
  return { used: [...used, topicId], current: topicId, spunOn: today };
}

// Uniform random integer in [0, n) from the browser's cryptographic generator.
export function randomIndex(n) {
  const limit = Math.floor(2 ** 32 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}

export function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
