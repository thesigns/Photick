// Checks data/topics.json after editing it:  node tools/check-topics.mjs
// Unique ids, both languages and a hint in each, no topic worded the same way twice.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LANGUAGES = ['en', 'pl'];
const MAX_HINT = 140; // characters; a hint should fit in two or three lines under the topic

const file = fileURLToPath(new URL('../data/topics.json', import.meta.url));
const { topics } = JSON.parse(readFileSync(file, 'utf8'));

let problems = 0;
const problem = (msg) => {
  problems++;
  console.log(`✗ ${msg}`);
};

const ids = new Set();
const texts = Object.fromEntries(LANGUAGES.map((l) => [l, new Map()]));
for (const t of topics) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id ?? '')) problem(`bad id: ${JSON.stringify(t)}`);
  if (ids.has(t.id)) problem(`duplicate id: ${t.id}`);
  ids.add(t.id);
  for (const l of LANGUAGES) {
    if (!t[l]?.trim()) problem(`${t.id}: missing "${l}"`);
    else if (texts[l].has(t[l])) problem(`${t.id}: "${t[l]}" is also used by ${texts[l].get(t[l])}`);
    else texts[l].set(t[l], t.id);
    const hint = t.hint?.[l]?.trim();
    if (!hint) problem(`${t.id}: missing hint "${l}"`);
    else if (hint.length > MAX_HINT) problem(`${t.id}: hint "${l}" is ${hint.length} characters, keep it under ${MAX_HINT}`);
  }
}

console.log(`${topics.length} topics`);
if (problems) {
  console.log(`${problems} problem(s).`);
  process.exit(1);
}
console.log('OK');
