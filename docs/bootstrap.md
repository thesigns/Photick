# Photick: spin the wheel for a photo topic

This document describes the idea, the constraints and the order of work.

## The idea in one paragraph

You spin a huge wheel of about 400 photo topics, the kind you'd see in a photo contest: "solitude in a crowd", "light and shadow", "rhythm of nature", "reflections". It lands on one — that's your topic. You can spin once per calendar day, and the topic stays until you spin again, so you can shoot it for as many days as you like. A drawn topic doesn't come back until every topic on the wheel has been drawn: the wheel visibly shrinks. You tap "Take a photo", the phone's own camera opens, and afterwards the app offers to share the photo — to Google Photos, iCloud, Instagram, a chat, anywhere. The file is already named after the date and topic and comes with a caption. The app judges nothing.

## Hard constraints

- **PWA, fully static.** Hosted on GitHub Pages. No backend, no database, no accounts, no API keys, no tracking.
- **Vanilla JS + HTML + CSS.** No frameworks and no build step, unless one turns out to be truly necessary — ask first in that case.
- **Works offline** after the first launch (service worker) and can be installed on the home screen.
- **The phone's own camera, at full quality** (`<input type="file" accept="image/*" capture="environment">`). Some phones also let you pick from the gallery here; that's fine — nothing is being judged.
- **Nothing leaves the phone** unless the user shares it themselves. The only thing the app keeps is the wheel's progress and the chosen language, in the browser's local storage.
- **Interface in English and Polish.** The language follows the phone's settings (Polish for `pl`, English otherwise) and can be switched with the EN/PL button; the choice is remembered. README, this document and code comments are in English.

## How it works

### The wheel
- Every player has their own wheel; there's no shared topic of the day.
- **One spin per calendar day** (local midnight). After spinning, the topic stays until the next spin — tomorrow or a week later, whenever the player chooses.
- **Hard rule: no re-rolls.** The result is saved the moment the wheel is flicked, before it stops, so reloading the page mid-spin can't undo it.
- **Fair draw.** The result is picked uniformly from the topics left, with the browser's cryptographic random generator (`crypto.getRandomValues`). The animation only shows it: the drawn topic is swapped into the spot where the flick would naturally stop (both spots are off screen), so the wheel behaves physically and the way you flick can't bias the outcome. If the drawn topic happens to be on screen, the wheel travels to it instead.
- **The wheel shrinks.** Drawn topics leave the wheel until all of them have been drawn; then it's full again (minus the topic you just had, so it can't come up twice in a row). The home screen shows "N of 400 left on the wheel".
- Cheating (clearing site data, changing the phone's clock) is possible and doesn't matter — it's a game for yourself. Clearing site data resets the wheel.

On screen: a slice of a huge wheel whose rim runs down the left edge, with tick marks and topics sticking out like spokes, and a pointer at the middle. Drag it with your thumb; a flick spins it (a slow drag just moves it). A "Spin" button does the same for those who can't or don't want to flick. Android vibrates lightly as topics pass the pointer. With reduced motion turned on, the wheel jumps almost straight to the result.

Code: `js/wheel.js` (rules, pure functions, also runs in Node), `js/wheel-view.js` (drawing and gestures), `js/app.js` (screens).

Saved progress (`localStorage`, key `photick.wheel`): `{ "used": [ids drawn this round], "current": id, "spunOn": "YYYY-MM-DD" }`.

### Topics
The list is built into the app (`data/topics.json`, 400 topics):

```json
{"id": "solitude-in-a-crowd", "en": "solitude in a crowd", "pl": "samotność w tłumie",
 "hint": {"en": "One person alone among many — or the feeling of being apart while surrounded.",
          "pl": "Jedna osoba sama wśród wielu — albo poczucie osobności, gdy dookoła tłum."}}
```

- The `id` is stored on players' phones, so **never change an id**. Reword `en`/`pl` freely.
- **Every topic has a hint** in both languages, shown under the topic on the home screen. One sentence, at most 140 characters (on average about 80). A hint points the way without prescribing the photo: what to look for, a few different leads, and for abstract topics two possible approaches. It must work on any day (no "after the rain"), and topics with people get a quiet note about tact or consent. It explains photo terms for beginners (high key, bokeh, rule of thirds…).
- Adding a topic: it simply appears on everyone's wheel among the topics left.
- Deleting a topic: it disappears from wheels; if it was someone's current topic, their app opens the wheel instead.
- Topics are short, lowercase, and must be doable on any day of the year, in any weather: no "snow", "rain" or "spring flowers". Polish versions are natural contest phrasing, not word-for-word translations.
- `node tools/check-topics.mjs` checks the file: unique ids, both languages, a hint in each language within the length limit, no topic worded the same way twice.
- Interface strings live in `js/i18n.js`; adding a language means a new entry there and a new field on every topic.

### Photo and sharing
1. "Take a photo" opens the phone's camera through a hidden file input.
2. The preview screen shows the photo with the date and topic, plus "Retake" and "Share".
3. The file is renamed to `photick-YYYY-MM-DD-topic.jpg` (local date, topic in the current language with accents removed, e.g. `photick-2026-10-04-swiatlo-i-cien.jpg`).
4. "Share" uses the Web Share API with the file, a title (the topic) and a caption: `topic · Photick, 4 Oct 2026 #photick` (date in the current language). Some apps drop the caption; the file name usually survives.
5. Where sharing files isn't available (some desktop browsers) the button says "Save" and downloads the file.

### Offline
`sw.js` caches the app's files on install (bypassing the HTTP cache, so a new version never mixes with old files) and serves them stale-while-revalidate: instantly from the cache, refreshed from the network in the background. A new version shows up on the next launch. Bump `CACHE` when the list of files changes.

## Milestones

After each stage, stop and wait until I've tested on the phone. Don't move on by yourself.

**M1 — topic and sharing.** Topic screen, the phone's camera, preview, share/save, PWA (manifest, icons, service worker, offline). Minimalist look made for the phone, light and dark theme following the system setting. English and Polish. Done.

**M2 — the wheel.** Personal wheel instead of a shared topic of the day: one spin per calendar day, the topic stays until the next spin, no re-rolls, fair draw, shrinking wheel. A hint for every topic, in both languages. ← current

## Ideas for later (not now)

- an optional caption burned into the photo, so the topic survives apps that drop captions,
- a list of your drawn topics, or a local diary of thumbnails (needs care with storage and export),
- a daily reminder via a calendar file (`.ics`), since push notifications need a server,
- Android extras: an app-icon shortcut, Photick as a share target,
- an AI "juror" that comments on the photo (needs a small server and a paid API; photos would leave the phone).

## History

- First prototype: scored photos on the phone with CLIP (transformers.js) against concrete, findable topics ("bench", "postbox") grouped by area. It worked for concrete objects but couldn't judge contest-style topics, so it was dropped.
- Then: one shared topic of the day for everyone, computed from the date. Replaced by the personal wheel, which gives a reason to come back and a visible sense of progress.

## Testing on a computer

`node tools/serve.mjs`, then `http://localhost:8080/`. On a computer the camera button opens a file picker; "Share" opens the system share dialog if the browser supports it, otherwise it becomes "Save". Because of the service worker, a change shows up after the second reload (or tick "Update on reload" in DevTools → Application → Service workers). To spin again during testing, run `localStorage.removeItem('photick.wheel')` in the console and reload.

## Way of working

- Small steps, each one working and testable.
- When choosing a library or API, check the current documentation.
- If something in this document turns out to be infeasible or clearly wrong, tell me instead of working around it.
