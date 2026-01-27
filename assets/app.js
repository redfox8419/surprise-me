/* Clawdbot Control Centre — single-file static SPA
   - Hash router with 4 views
   - localStorage persistence for beacons, agents, automations, settings
   - Background canvas visuals (performant)
*/

const $ = (id) => document.getElementById(id);

const canvas = $('bg');
const ctx = canvas.getContext('2d', { alpha: true });

// UI
const consoleEl = $('console');
const clockEl = $('clock');
const btnFullscreen = $('btnFullscreen');
const btnBloom = $('btnBloom');
const btnCalm = $('btnCalm');
const btnReset = $('btnReset');
const kBeacon = $('kBeacon');
const kDrift = $('kDrift');
const kMood = $('kMood');

const navLinks = Array.from(document.querySelectorAll('.navlink'));
const views = Array.from(document.querySelectorAll('.view'));
const pageTitle = $('pageTitle');

let W = 0, H = 0, DPR = 1;
let running = true;

const storageKey = 'clawdbot:v1';

const defaults = {
  beacons: [],
  mood: 0.55,
  drift: 0.25,
  agents: [],
  automations: [],
};

let state = Object.assign({}, defaults);

function loadState(){
  try{
    const raw = localStorage.getItem(storageKey);
    if(raw) state = Object.assign({}, defaults, JSON.parse(raw));
  }catch(e){ console.warn('load error', e); }
}
function saveState(){
  try{ localStorage.setItem(storageKey, JSON.stringify({
    beacons: state.beacons,
    mood: state.mood,
    drift: state.drift,
    agents: state.agents,
    automations: state.automations
  })); }catch(e){ console.warn('save error',e); }
}

loadState();

state.stars = [];
state.particles = [];
state.lastTs = performance.now();
state.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  if (consoleEl.children.length > 120) consoleEl.removeChild(consoleEl.firstChild);
}
addLog('Boot sequence: good morning.', 'ok');
addLog('Status: pleasantly sinister.', 'info');
setInterval(tickConsole, state.reduced ? 3500 : 2400);

function setKpis() {
  const beacons = state.beacons || [];
  kBeacon.textContent = String(beacons.length);
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

function addBeacon(x, y, persist = true) {
  state.beacons.push({ x, y, t: 0, phase: rand(0, Math.PI * 2) });
  if (state.beacons.length > 20) state.beacons.shift();
  spawnBloom(x, y, 0.9);
  setKpis();
  addLog(`Beacon dropped @ ${Math.round(x)},${Math.round(y)}`, 'ok');
  if (persist) saveState();
}

// restore beacons from state
if (state.beacons && state.beacons.length) {
  for (const b of state.beacons) {
    // nothing to do — they will render
  }
}

window.addEventListener('pointerdown', (e) => {
  // ignore clicks on UI elements
  if (e.target.closest('.nav') || e.target.closest('.card') || e.target.closest('button') || e.target.closest('a') || e.target.closest('input')) return;
  addBeacon(e.clientX, e.clientY);
  saveState();
});

function drawBackground(ts) {
  ctx.clearRect(0, 0, W, H);

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(0,0,0,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0.60)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (const s of state.stars) {
    s.tw += s.sp;
    const a = 0.18 + 0.38 * (0.5 + 0.5 * Math.sin(s.tw));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const col = colour();
  for (const b of state.beacons) b.t += 0.016;

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
  let t = 0;
  setInterval(() => { t += 1000; drawBackground(t); }, 1000);
}

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running && !state.reduced) requestAnimationFrame(loop);
});

// controls
btnBloom.addEventListener('click', () => {
  state.mood = clamp(state.mood + 0.12, 0.1, 0.95);
  state.drift = clamp(state.drift + 0.05, 0.05, 0.6);
  spawnBloom(W * 0.5, H * 0.38, 1.1);
  addLog('Bloom triggered. Reality slightly improved.', 'ok');
  setKpis();
  saveState();
});

btnCalm.addEventListener('click', () => {
  state.mood = clamp(state.mood - 0.08, 0.1, 0.95);
  state.drift = clamp(state.drift - 0.08, 0.05, 0.6);
  addLog('Calm mode engaged. Panic postponed.', 'info');
  setKpis();
  saveState();
});

btnReset.addEventListener('click', () => {
  state.beacons = [];
  state.particles = [];
  seedStars();
  addLog('Reset. Fresh slate. Same universe.', 'warn');
  setKpis();
  saveState();
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
      btnFullscreen.textContent = 'Full';
      addLog('Fullscreen exited. Back to reality.', 'info');
    }
  } catch {
    addLog('Fullscreen blocked. Press F11 like it’s 2009.', 'warn');
  }
}
btnFullscreen.addEventListener('click', toggleFullscreen);

// Router
function routeTo(path){
  navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('data-route') === path));
  views.forEach(v => v.classList.add('hidden'));
  const id = path === '/' ? 'view-dashboard' : 'view-' + path.slice(1);
  const el = $(id);
  if(el) el.classList.remove('hidden');
  pageTitle.textContent = ({'/':'Dashboard','/agents':'Agents','/automations':'Automations','/about':'About'})[path] || '';
}

function onHash(){
  const h = location.hash.replace('#','') || '/';
  routeTo(h);
}
window.addEventListener('hashchange', onHash);
onHash();

// Agents
const agentForm = $('agentForm');
const agentName = $('agentName');
const agentRole = $('agentRole');
const agentList = $('agentList');

function renderAgents(){
  agentList.innerHTML = '';
  (state.agents||[]).forEach((a, idx)=>{
    const li = document.createElement('li');
    li.className = 'list__item';
    li.innerHTML = `<div><strong>${a.name}</strong> <span class="muted">${a.role}</span></div><div class="list__actions"><button data-idx="${idx}" class="btn small rem">Remove</button></div>`;
    agentList.appendChild(li);
  });
}

agentForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = agentName.value.trim();
  if(!name) return;
  state.agents = state.agents || [];
  state.agents.push({ name, role: agentRole.value, id: Date.now() });
  agentName.value = '';
  saveState();
  renderAgents();
  addLog(`Agent ${name} created.`, 'ok');
});

agentList.addEventListener('click', (e)=>{
  if(e.target.matches('button.rem')){
    const idx = Number(e.target.getAttribute('data-idx'));
    const removed = state.agents.splice(idx,1)[0];
    saveState(); renderAgents(); addLog(`Agent ${removed.name} removed.`, 'warn');
  }
});
renderAgents();

// Automations
const automationForm = $('automationForm');
const automationName = $('automationName');
const automationType = $('automationType');
const automationData = $('automationData');
const automationList = $('automationList');

function renderAutomations(){
  automationList.innerHTML = '';
  (state.automations||[]).forEach((a, idx)=>{
    const li = document.createElement('li');
    li.className = 'list__item';
    li.innerHTML = `<div><strong>${a.name}</strong> <span class="muted">${a.type} ${a.data||''}</span></div><div class="list__actions"><button data-idx="${idx}" class="btn small rem">Remove</button></div>`;
    automationList.appendChild(li);
  });
}

automationForm.addEventListener('submit',(e)=>{
  e.preventDefault();
  const name = automationName.value.trim();
  if(!name) return;
  state.automations = state.automations || [];
  state.automations.push({ name, type: automationType.value, data: automationData.value, id: Date.now() });
  automationName.value = ''; automationData.value = '';
  saveState(); renderAutomations(); addLog(`Automation ${name} created.`, 'ok');
});

automationList.addEventListener('click',(e)=>{
  if(e.target.matches('button.rem')){
    const idx = Number(e.target.getAttribute('data-idx'));
    const removed = state.automations.splice(idx,1)[0];
    saveState(); renderAutomations(); addLog(`Automation ${removed.name} removed.`, 'warn');
  }
});
renderAutomations();

// import/export
$('importBtn').addEventListener('click', ()=>{
  const raw = prompt('Paste JSON state to import');
  if(!raw) return;
  try{ const obj = JSON.parse(raw); state = Object.assign({}, defaults, obj); saveState(); seedStars(); renderAgents(); renderAutomations(); setKpis(); addLog('State imported.', 'ok'); }catch(e){ addLog('Import failed.', 'warn'); }
});
$('exportBtn').addEventListener('click', ()=>{ const out = JSON.stringify({beacons:state.beacons,agents:state.agents,automations:state.automations,mood:state.mood,drift:state.drift},null,2); navigator.clipboard.writeText(out); addLog('State copied to clipboard.', 'ok'); });

// simple timed automation executor (demo)
setInterval(()=>{
  const now = Date.now();
  for(const a of (state.automations||[])){
    if(a.type==='timer' && a.data){
      const m = a._last || 0;
      // parse simple like '10s' or '1m'
      const match = String(a.data).match(/^(\d+)(s|m)?$/);
      if(match){
        const val = Number(match[1]);
        const unit = match[2]||'s';
        const ms = unit==='m' ? val*60000 : val*1000;
        if(!a._last || (now - a._last) > ms){
          a._last = now;
          addLog(`Automation ${a.name} fired (timer).`, 'ok');
          // demo action: bloom
          spawnBloom(W*0.5, H*0.5, 1.0);
        }
      }
    }
    if(a.type==='beacon'){
      // demo: if there are any beacons, trigger once per 30s
      if((state.beacons||[]).length && (!a._last || Date.now()-a._last>30000)){
        a._last = Date.now(); addLog(`Automation ${a.name} fired (beacon).`, 'ok'); spawnBloom(rand(40,W-40), rand(40,H-40), 1.0);
      }
    }
  }
  saveState();
}, 2500);

// set initial UI
setKpis();

// small helpers
function $(id){ return document.getElementById(id); }

// expose for debugging
window._claw = { state, saveState, addBeacon };

// ensure stars match size
window.addEventListener('resize', seedStars);

console.log('Clawdbot loaded');
