/* Surprise Me — a tiny self-contained mood machine.
   Keep it pretty. Keep it light. Keep it slightly ominous.
*/

const $ = (id) => document.getElementById(id);

const canvas = $('bg');
const ctx = canvas.getContext('2d', { alpha: true });

const consoleEl = $('console');
const clockEl = $('clock');
const btnFullscreen = $('btnFullscreen');
const btnBloom = $('btnBloom');
const btnCalm = $('btnCalm');
const btnReset = $('btnReset');

const kBeacon = $('kBeacon');
const kDrift = $('kDrift');
const kMood = $('kMood');

let W = 0, H = 0, DPR = 1;
let running = true;

const state = {
  beacons: [],
  stars: [],
  particles: [],
  drift: 0.25,
  mood: 0.55,
  lastTs: performance.now(),
  reduced: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

function resize() {
  DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  W = Math.floor(window.innerWidth);
  H = Math.floor(window.innerHeight);
  canvas.width = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function colour() {
  // mint-cyan range
  const t = state.mood;
  const c1 = { r: 61, g: 252, b: 255 };
  const c2 = { r: 91, g: 255, b: 176 };
  const r = Math.round(c1.r * (1 - t) + c2.r * t);
  const g = Math.round(c1.g * (1 - t) + c2.g * t);
  const b = Math.round(c1.b * (1 - t) + c2.b * t);
  return `rgb(${r},${g},${b})`;
}

function seedStars() {
  const n = state.reduced ? 60 : 140;
  state.stars = Array.from({ length: n }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: rand(0.6, 2.0),
    tw: rand(0, Math.PI * 2),
    sp: rand(0.002, 0.016),
  }));
}
seedStars();

function addLog(msg, level = 'info') {
  const row = document.createElement('div');
  row.className = 'row';

  const t = document.createElement('div');
  t.className = 't';
  t.textContent = new Date().toLocaleTimeString();

  const m = document.createElement('div');
  m.className = 'm';
  m.textContent = msg;
  if (level === 'warn') m.classList.add('warn');
  if (level === 'ok') m.classList.add('ok');

  row.appendChild(t);
  row.appendChild(m);
  consoleEl.appendChild(row);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

const phrases = [
  ['Handshake established', 'ok'],
  ['Collecting small truths…', 'info'],
  ['Staring into the void (politely)', 'info'],
  ['Recalibrating optimism… failed', 'warn'],
  ['Allocating vibes', 'ok'],
  ['Spinning up imagination engine', 'ok'],
  ['Suppressing chaos (best-effort)', 'info'],
  ['Reality check: still reality', 'warn'],
];

function tickConsole() {
  const [msg, lvl] = phrases[Math.floor(Math.random() * phrases.length)];
  addLog(msg, lvl);
  // keep it light
  if (consoleEl.children.length > 80) consoleEl.removeChild(consoleEl.firstChild);
}

addLog('Boot sequence: good morning.', 'ok');
addLog('Status: pleasantly sinister.', 'info');
setInterval(tickConsole, state.reduced ? 3500 : 2200);

function setKpis() {
  kBeacon.textContent = String(state.beacons.length);
  kDrift.textContent = state.drift < 0.18 ? 'low' : state.drift < 0.3 ? 'medium' : 'spicy';
  kMood.textContent = state.mood < 0.45 ? 'icy' : state.mood < 0.7 ? 'cosmic' : 'mint';
}
setKpis();

function spawnBloom(x, y, strength = 1) {
  const n = state.reduced ? 30 : 70;
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x, y,
      vx: rand(-2.2, 2.2) * strength,
      vy: rand(-2.2, 2.2) * strength,
      life: 0,
      max: rand(26, 60),
      r: rand(1.0, 2.8),
    });
  }
}

function addBeacon(x, y) {
  state.beacons.push({ x, y, t: 0, phase: rand(0, Math.PI * 2) });
  if (state.beacons.length > 9) state.beacons.shift();
  spawnBloom(x, y, 0.9);
  setKpis();
  addLog(`Beacon dropped @ ${Math.round(x)},${Math.round(y)}`, 'ok');
}

window.addEventListener('pointerdown', (e) => {
  addBeacon(e.clientX, e.clientY);
});

function drawBackground(ts) {
  ctx.clearRect(0, 0, W, H);

  // subtle gradient wash
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0.60)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // stars
  for (const s of state.stars) {
    s.tw += s.sp;
    const a = 0.18 + 0.38 * (0.5 + 0.5 * Math.sin(s.tw));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // beacons + links
  const col = colour();
  for (const b of state.beacons) b.t += 0.016;

  // links
  for (let i = 0; i < state.beacons.length; i++) {
    for (let j = i + 1; j < state.beacons.length; j++) {
      const a = state.beacons[i];
      const b = state.beacons[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d < 520) {
        const alpha = clamp(0.22 - d / 2600, 0, 0.22);
        ctx.strokeStyle = `rgba(61,252,255,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  // nodes
  for (const b of state.beacons) {
    const pulse = 6 + 6 * (0.5 + 0.5 * Math.sin(ts * 0.002 + b.phase));
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.arc(b.x, b.y, pulse + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.22;
    ctx.arc(b.x, b.y, pulse + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.arc(b.x, b.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life += 1;
    const t = p.life / p.max;
    const a = 1 - t;
    ctx.fillStyle = `rgba(91,255,176,${0.6 * a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    if (t >= 1) state.particles.splice(i, 1);
  }

  // vignette
  const v = ctx.createRadialGradient(W * 0.5, H * 0.55, 40, W * 0.5, H * 0.55, Math.max(W, H) * 0.55);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

function loop(ts) {
  if (!running) return;
  drawBackground(ts);
  requestAnimationFrame(loop);
}
if (!state.reduced) requestAnimationFrame(loop);
else {
  // low-motion mode: draw at ~1fps
  let t = 0;
  setInterval(() => { t += 1000; drawBackground(t); }, 1000);
}

// controls
btnBloom.addEventListener('click', () => {
  state.mood = clamp(state.mood + 0.12, 0.1, 0.95);
  state.drift = clamp(state.drift + 0.05, 0.05, 0.6);
  spawnBloom(W * 0.5, H * 0.38, 1.1);
  addLog('Bloom triggered. Reality slightly improved.', 'ok');
  setKpis();
});

btnCalm.addEventListener('click', () => {
  state.mood = clamp(state.mood - 0.08, 0.1, 0.95);
  state.drift = clamp(state.drift - 0.08, 0.05, 0.6);
  addLog('Calm mode engaged. Panic postponed.', 'info');
  setKpis();
});

btnReset.addEventListener('click', () => {
  state.beacons = [];
  state.particles = [];
  seedStars();
  addLog('Reset. Fresh slate. Same universe.', 'warn');
  setKpis();
});

function tickClock() {
  clockEl.textContent = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date());
}
setInterval(tickClock, 500);
tickClock();

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      btnFullscreen.textContent = 'Exit';
      addLog('Fullscreen engaged. No distractions.', 'ok');
    } else {
      await document.exitFullscreen();
      btnFullscreen.textContent = 'Full screen';
      addLog('Fullscreen exited. Back to reality.', 'info');
    }
  } catch {
    addLog('Fullscreen blocked. Press F11 like it’s 2009.', 'warn');
  }
}
btnFullscreen.addEventListener('click', toggleFullscreen);

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running && !state.reduced) requestAnimationFrame(loop);
});
