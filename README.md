# photick.

Spin the wheel, get a photo topic, go out and shoot it.

**Try it: [thesigns.github.io/Photick](https://thesigns.github.io/Photick/)** — open it on your phone and add it to your home screen.

A huge wheel holds about 400 photo topics — "solitude in a crowd", "light and shadow", "rhythm of nature", "reflections". Flick it with your thumb and it lands on one. That's your topic until you spin again — take your phone's camera and go find it.

## How it works

- **One spin a day.** You can spin once per calendar day. The topic stays until your next spin, so you can take your time with it.
- **No re-rolls.** Whatever comes up is your topic.
- **The wheel shrinks.** A drawn topic doesn't come back until you've drawn all of them. The draw is truly random — the animation only shows the result.
- **A hint for every topic.** One sentence that points the way without giving the answer — and explains photo terms like "high key" or "rule of thirds".
- **English and Polish.** The app follows your phone's language and has an EN/PL switch.
- **Works offline** and can be installed on the home screen.

## Privacy

There are no accounts, no server and no tracking. The app never sees your photos. The wheel's progress is kept only in your browser.

## Technology

Plain HTML, CSS and JavaScript — no frameworks, no build step, no dependencies. Hosted on GitHub Pages. A service worker keeps it working offline.

```
index.html, style.css   the app
js/app.js               screens
js/wheel.js             the wheel's rules: one spin a day, fair draw, shrinking wheel
js/wheel-view.js        drawing the wheel and spinning it with your thumb
js/i18n.js              interface strings (English, Polish)
data/topics.json        the topic list, in both languages
sw.js                   offline cache
manifest.webmanifest    home-screen install
icons/                  app icons
tools/serve.mjs         local server for testing
tools/check-topics.mjs  checks the topic list
docs/bootstrap.md       project brief and decisions
```

## Development

Requires Node.js (any recent version) only for the tools:

```
node tools/serve.mjs          # http://localhost:8080/
node tools/check-topics.mjs   # after editing data/topics.json
```

Because of the service worker, local changes show up after the second reload. To spin again while testing, run `localStorage.removeItem('photick.wheel')` in the browser console and reload.

### Editing topics

Topics live in `data/topics.json`:

```json
{"id": "solitude-in-a-crowd", "en": "solitude in a crowd", "pl": "samotność w tłumie",
 "hint": {"en": "One person alone among many — or the feeling of being apart while surrounded.",
          "pl": "Jedna osoba sama wśród wielu — albo poczucie osobności, gdy dookoła tłum."}}
```

Add and remove topics freely and reword `en`/`pl` as you like, but **never change an `id`** — players' phones remember topics by id. Topics should be short, lowercase, and doable on any day of the year, in any weather. Every topic needs a one-sentence hint in both languages (at most 140 characters).

## License

[MIT](LICENSE) © 2026 Jakub W. Adamczyk
