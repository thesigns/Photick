// The spinning wheel on screen: a slice of a huge wheel whose rim runs down the left edge,
// with topics sticking out of it like spokes. Drag it with your thumb; a flick spins it.
//
// `pos` is a position along the wheel measured in topics: the topic at the pointer is
// items[round(pos) mod n]. The outcome of a spin is chosen by the app before the wheel
// moves; the animation only decelerates onto it, so the way you flick can't bias it.

const SPACING = 74; // px between neighbouring topics along the rim
const MAX_VISIBLE = 8; // at most this many topics above and below the pointer, fewer on short screens
const TICKS = 14; // rim ticks shown above and below the pointer
const FLICK = 2.5; // topics per second; slower releases don't spin

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = (t) => 1 - (1 - t) ** 3;

export function createWheel(el, { labelOf, onFlick, onTick }) {
  let items = [];
  let pos = 0;
  let spinning = false;
  let interactive = true;
  let drag = null;

  const rim = Object.assign(document.createElement('div'), { className: 'wheel-rim' });
  const pointer = Object.assign(document.createElement('div'), { className: 'wheel-pointer' });
  const ticks = Array.from({ length: TICKS * 2 + 1 }, () => Object.assign(document.createElement('div'), { className: 'wheel-tick' }));
  const labels = Array.from({ length: MAX_VISIBLE * 2 + 1 }, () => Object.assign(document.createElement('div'), { className: 'wheel-label' }));
  el.append(rim, ...ticks, ...labels, pointer);

  function geometry() {
    const w = el.clientWidth;
    const h = el.clientHeight;
    const R = h * 2.6; // radius of the huge wheel; only a slice is visible
    return { w, h, R, cx: -R + 40, cy: h / 2, step: SPACING / R };
  }

  function render() {
    const n = items.length;
    const { w, h, R, cx, cy, step } = geometry();
    const visible = Math.min(MAX_VISIBLE, Math.floor(h / 2 / SPACING));
    rim.style.cssText = `left:${cx - R}px; top:${cy - R}px; width:${2 * R}px; height:${2 * R}px`;

    const base = Math.round(pos);
    const half = n ? Math.min(visible, Math.floor((n - 1) / 2)) : -1;
    labels.forEach((label, k) => {
      const i = base + k - MAX_VISIBLE;
      if (Math.abs(i - base) > half) {
        label.style.opacity = '0';
        return;
      }
      const o = i - pos;
      const theta = o * step;
      const d = Math.abs(o);
      const text = labelOf(items[((i % n) + n) % n]);
      if (label.textContent !== text) label.textContent = text;
      const x = cx + (R + 24) * Math.cos(theta);
      const y = cy + (R + 24) * Math.sin(theta);
      label.style.width = `${w - 80}px`;
      label.style.transform = `translate(${x}px, ${y}px) rotate(${theta}rad) scale(${Math.max(0.55, 1 - d * 0.14)}) translateY(-50%)`;
      label.style.opacity = String(Math.max(0, 1 - d / (half + 1.2)));
      label.classList.toggle('at-pointer', d < 0.5);
    });

    // Ticks along the rim, one per topic, moving with the wheel.
    ticks.forEach((tick, k) => {
      const o = base + k - TICKS - pos;
      const theta = o * step;
      const x = cx + R * Math.cos(theta);
      const y = cy + R * Math.sin(theta);
      tick.style.transform = `translate(${x}px, ${y}px) rotate(${theta}rad) translate(-14px, -1px)`;
      tick.style.opacity = n ? String(Math.max(0, 1 - Math.abs(o) / TICKS)) : '0';
    });
  }

  // ---------- dragging ----------

  el.addEventListener('pointerdown', (e) => {
    if (spinning || !interactive || !items.length) return;
    try {
      el.setPointerCapture(e.pointerId); // keep receiving moves when the thumb leaves the wheel
    } catch {
      // not essential
    }
    drag = { y: e.clientY, samples: [{ t: e.timeStamp, pos }] };
  });

  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    pos -= (e.clientY - drag.y) / SPACING;
    drag.y = e.clientY;
    drag.samples.push({ t: e.timeStamp, pos });
    drag.samples = drag.samples.filter((s) => e.timeStamp - s.t < 100);
    render();
  });

  function release(e) {
    if (!drag) return;
    const first = drag.samples[0];
    const dt = (e.timeStamp - first.t) / 1000;
    const velocity = dt > 0 ? (pos - first.pos) / dt : 0;
    drag = null;
    if (Math.abs(velocity) >= FLICK) onFlick(velocity);
    else settle();
  }
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);

  // A slow release just eases to the nearest topic.
  function settle() {
    animate(pos, Math.round(pos), 180);
  }

  // ---------- animation ----------

  function animate(from, to, ms) {
    return new Promise((resolve) => {
      const start = performance.now();
      let lastIndex = Math.round(from);
      const frame = (now) => {
        const t = Math.min(1, (now - start) / ms);
        pos = from + (to - from) * easeOut(t);
        const index = Math.round(pos);
        if (index !== lastIndex) {
          lastIndex = index;
          onTick?.();
        }
        render();
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  // Spins in the direction of `velocity` (topics/s) and stops exactly on items[target].
  async function spinTo(target, velocity) {
    const n = items.length;
    const dir = velocity < 0 ? -1 : 1;
    const speed = Math.max(Math.abs(velocity), 8);
    const offscreen = MAX_VISIBLE + 2;
    // How far a flick of this speed would naturally carry the wheel.
    const natural = reducedMotion() ? offscreen : Math.min(Math.max(speed * 1.2, offscreen), 150);
    const stop = Math.round(pos + dir * natural);
    const slot = ((stop % n) + n) % n;
    const ring = (a, b) => Math.min(((a - b) % n + n) % n, ((b - a) % n + n) % n);
    let end;
    if (n > 2 * offscreen + 1 && ring(target, Math.round(pos)) > offscreen && ring(slot, Math.round(pos)) > offscreen) {
      // The wheel's order is random anyway, so the drawn topic swaps places with whatever sits where
      // the wheel would stop. Both places are off screen, so nothing visibly changes, and the wheel
      // stops where the flick takes it instead of racing hundreds of topics further.
      [items[slot], items[target]] = [items[target], items[slot]];
      end = stop;
    } else {
      // Few topics left, or the drawn one is on screen right now: travel to it.
      end = dir > 0
        ? target + n * Math.ceil((pos + natural - target) / n)
        : target + n * Math.floor((pos - natural - target) / n);
    }
    // With an ease-out curve the starting speed is 3·distance/duration, so this keeps the flick's speed.
    const ms = reducedMotion() ? 300 : Math.min(Math.max((3 * Math.abs(end - pos) / speed) * 1000, 2200), 6000);
    spinning = true;
    await animate(pos, end, ms);
    spinning = false;
    pos = end;
    render();
  }

  new ResizeObserver(render).observe(el);

  return {
    setItems(list) {
      items = list;
      pos = 0;
      render();
    },
    setInteractive(value) {
      interactive = value;
    },
    get spinning() {
      return spinning;
    },
    spinTo,
    render,
  };
}
