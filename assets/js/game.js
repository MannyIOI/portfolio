/* ═══════════════════════════════════════════════════════════
   Pipeline Runner — a small 3D endless runner for play.html.
   You are a data packet: switch lanes to dodge bugs, jump
   firewalls, collect records. Three.js (vendored, r170).
   ═══════════════════════════════════════════════════════════ */
import * as THREE from '../vendor/three.module.min.js';
import { fetchBoard, submitRun, renderBoard, placeRun, placeSaved } from './leaderboard.js';
import { drawCard, cardToBlob, challengeUrl, readChallenge } from './share.js';

const $ = (s) => document.querySelector(s);

/* ── tuning ─────────────────────────────────────────────── */
const LANES = [-2.2, 0, 2.2];
const BASE_Y = 0.55;          // packet centre height at rest
const RADIUS = 0.45;
const JUMP_V = 9.6;
const GRAVITY = 26;
const START_SPEED = 14;
const MAX_SPEED = 40;
const ACCEL = 0.38;           // units/s gained per second
const SPAWN_Z = -120;         // where new rows appear
const DESPAWN_Z = 12;
const RECORD_POINTS = 25;

const COLORS = {
  ink: 0x08080c, bone: 0xf2efe8, acid: 0xd7ff3e,
  violet: 0x6e4bff, coral: 0xff5a3c, cyan: 0x35e7ff,
};

const QUIPS = [
  'Even the best pipelines drop a packet. Mine come with monitoring. <a href="./#contact">Say hi →</a>',
  'That bug made it to production. I usually catch them earlier. <a href="./#work">See how →</a>',
  'Latency spike detected. Retrying is free. Hiring me is also an option. <a href="./#contact">Get in touch →</a>',
  'Ingestion halted. In real life I\'d have an alert on that. <a href="./#work">Read the work →</a>',
];

/* ── renderer / scene ──────────────────────────────────── */
const canvas = $('#stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, powerPreference: 'high-performance' });
} catch (e) {
  document.body.insertAdjacentHTML('beforeend',
    '<div class="fallback"><p>Your browser couldn\'t start WebGL, so the game can\'t run here. <a href="./">Back to the portfolio →</a></p></div>');
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.ink);
scene.fog = new THREE.Fog(COLORS.ink, 30, 115);

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200);
const CAM_BASE = new THREE.Vector3(0, 4.1, 7.2);
camera.position.copy(CAM_BASE);
camera.lookAt(0, 0.6, -12);

scene.add(new THREE.HemisphereLight(0x8f86ff, 0x0d0d14, 0.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(3, 8, 6);
scene.add(keyLight);

/* ── floor: scrolling grid texture ─────────────────────── */
function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0b12';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(110,75,255,0.55)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(53,231,255,0.12)';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 40);
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const floorTex = gridTexture();
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(8.8, 240),
  new THREE.MeshBasicMaterial({ map: floorTex })
);
floor.rotation.x = -Math.PI / 2;
floor.position.z = -100;
scene.add(floor);

/* lane rails */
const railMat = new THREE.MeshBasicMaterial({ color: COLORS.violet });
for (const x of [-4.4, -1.1, 1.1, 4.4]) {
  const edge = Math.abs(x) > 4;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(edge ? 0.12 : 0.04, edge ? 0.12 : 0.02, 240), edge ? railMat : new THREE.MeshBasicMaterial({ color: 0x2a2250 }));
  rail.position.set(x, edge ? 0.06 : 0.011, -100);
  scene.add(rail);
}

/* pipeline rings flying past for a sense of speed */
const rings = [];
const ringGeo = new THREE.TorusGeometry(6.4, 0.05, 6, 48, Math.PI);
const ringMats = [
  new THREE.MeshBasicMaterial({ color: COLORS.violet, transparent: true, opacity: 0.55 }),
  new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.35 }),
];
for (let i = 0; i < 14; i++) {
  const r = new THREE.Mesh(ringGeo, ringMats[i % 2]);
  r.position.set(0, 0, -i * 9);
  scene.add(r);
  rings.push(r);
}

/* speed streaks */
const STREAKS = 220;
const streakPos = new Float32Array(STREAKS * 3);
function resetStreak(i, z) {
  const side = Math.random() < 0.5 ? -1 : 1;
  streakPos[i * 3] = side * (4.8 + Math.random() * 6);
  streakPos[i * 3 + 1] = Math.random() * 7;
  streakPos[i * 3 + 2] = z;
}
for (let i = 0; i < STREAKS; i++) resetStreak(i, -Math.random() * 120);
const streakGeo = new THREE.BufferGeometry();
streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
const streaks = new THREE.Points(streakGeo, new THREE.PointsMaterial({ color: COLORS.bone, size: 0.08, transparent: true, opacity: 0.7 }));
scene.add(streaks);

/* ── the packet ────────────────────────────────────────── */
const player = new THREE.Group();
const core = new THREE.Mesh(
  new THREE.IcosahedronGeometry(RADIUS, 0),
  new THREE.MeshStandardMaterial({ color: COLORS.acid, emissive: COLORS.acid, emissiveIntensity: 0.55, flatShading: true, roughness: 0.35 })
);
const shell = new THREE.Mesh(
  new THREE.IcosahedronGeometry(RADIUS * 1.35, 1),
  new THREE.MeshBasicMaterial({ color: COLORS.acid, wireframe: true, transparent: true, opacity: 0.35 })
);
player.add(core, shell);
const glow = new THREE.PointLight(COLORS.acid, 18, 9, 1.6);
glow.position.y = 0.4;
player.add(glow);
const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 24),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.02;
scene.add(player, shadow);

/* ── obstacles & pickups (pooled) ──────────────────────── */
const GEO = {
  bug: new THREE.BoxGeometry(1.3, 2.4, 1.3),
  bugCage: new THREE.BoxGeometry(1.45, 2.55, 1.45),
  wall: new THREE.BoxGeometry(1.9, 0.72, 0.35),
  record: new THREE.OctahedronGeometry(0.32, 0),
};
const MAT = {
  bug: new THREE.MeshStandardMaterial({ color: COLORS.coral, emissive: COLORS.coral, emissiveIntensity: 0.45, roughness: 0.4 }),
  bugCage: new THREE.MeshBasicMaterial({ color: COLORS.coral, wireframe: true, transparent: true, opacity: 0.5 }),
  wall: new THREE.MeshStandardMaterial({ color: COLORS.violet, emissive: COLORS.violet, emissiveIntensity: 0.7, roughness: 0.3, transparent: true, opacity: 0.92 }),
  record: new THREE.MeshStandardMaterial({ color: COLORS.acid, emissive: COLORS.acid, emissiveIntensity: 0.9, flatShading: true }),
};

const pool = { bug: [], wall: [], record: [] };
const live = [];

function make(type) {
  let m;
  if (type === 'bug') {
    m = new THREE.Group();
    m.add(new THREE.Mesh(GEO.bug, MAT.bug), new THREE.Mesh(GEO.bugCage, MAT.bugCage));
    m.userData.size = { w: 1.3, h: 2.4, d: 1.3 };
  } else if (type === 'wall') {
    m = new THREE.Mesh(GEO.wall, MAT.wall);
    m.userData.size = { w: 1.9, h: 0.72, d: 0.35 };
  } else {
    m = new THREE.Mesh(GEO.record, MAT.record);
    m.userData.size = { w: 0.7, h: 0.7, d: 0.7 };
  }
  m.userData.type = type;
  return m;
}

function spawn(type, lane, z) {
  const m = pool[type].pop() || make(type);
  const s = m.userData.size;
  m.position.set(LANES[lane], type === 'record' ? 0.75 : s.h / 2, z);
  m.rotation.set(0, 0, 0);
  m.visible = true;
  m.userData.lane = lane;
  m.userData.phase = Math.random() * Math.PI * 2;
  scene.add(m);
  live.push(m);
  return m;
}

function recycle(i) {
  const m = live[i];
  scene.remove(m);
  pool[m.userData.type].push(m);
  live.splice(i, 1);
}

/* row patterns: every row leaves at least one way through */
function spawnRow(z, difficulty) {
  const roll = Math.random();
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  if (roll < 0.34) {
    // one or two bugs
    const count = Math.random() < 0.25 + difficulty * 0.45 ? 2 : 1;
    for (let i = 0; i < count; i++) spawn('bug', lanes[i], z);
    const free = lanes[count];
    if (Math.random() < 0.6) for (let k = 0; k < 3; k++) spawn('record', free, z - 2.6 * k);
  } else if (roll < 0.62) {
    // firewall(s): jump them
    const count = difficulty > 0.35 && Math.random() < 0.5 ? 3 : 1 + (Math.random() < 0.4 ? 1 : 0);
    for (let i = 0; i < count; i++) spawn('wall', lanes[i], z);
    if (Math.random() < 0.5) spawn('record', lanes[0], z - 0.1).position.y = 2.1;
  } else if (roll < 0.8) {
    // bug + firewall mix
    spawn('bug', lanes[0], z);
    spawn('wall', lanes[1], z);
    spawn('record', lanes[2], z);
  } else {
    // a line of records weaving across
    let lane = lanes[0];
    for (let k = 0; k < 5; k++) {
      spawn('record', lane, z - k * 2.4);
      if (Math.random() < 0.35) lane = Math.max(0, Math.min(2, lane + (Math.random() < 0.5 ? -1 : 1)));
    }
  }
}

/* burst particles on crash / pickup */
const BURST = 60;
const burstPos = new Float32Array(BURST * 3);
const burstVel = new Float32Array(BURST * 3);
const burstGeo = new THREE.BufferGeometry();
burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
const burstMat = new THREE.PointsMaterial({ color: COLORS.coral, size: 0.16, transparent: true, opacity: 0 });
const burst = new THREE.Points(burstGeo, burstMat);
burst.frustumCulled = false;
scene.add(burst);
let burstLife = 0;
function fireBurst(pos, color, strength = 1) {
  burstMat.color.setHex(color);
  for (let i = 0; i < BURST; i++) {
    burstPos[i * 3] = pos.x; burstPos[i * 3 + 1] = pos.y; burstPos[i * 3 + 2] = pos.z;
    const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI;
    const sp = (2 + Math.random() * 6) * strength;
    burstVel[i * 3] = Math.cos(a) * Math.sin(b) * sp;
    burstVel[i * 3 + 1] = Math.abs(Math.cos(b)) * sp + 1;
    burstVel[i * 3 + 2] = Math.sin(a) * Math.sin(b) * sp;
  }
  burstGeo.attributes.position.needsUpdate = true;
  burstLife = 1;
}

/* ── sound: tiny WebAudio synth, no files ─────────────── */
const sound = (() => {
  let ctx = null, muted = false;
  try { muted = localStorage.getItem('pipeline-runner-muted') === '1'; } catch (e) {}
  function ensure() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.08, slide = 0) {
    if (muted) return;
    const a = ensure(); if (!a) return;
    const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    unlock: ensure,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem('pipeline-runner-muted', muted ? '1' : '0'); } catch (e) {}
      return muted;
    },
    pickup(combo) { tone(660 + combo * 90, 0.12, 'triangle', 0.07); },
    jump() { tone(300, 0.16, 'sine', 0.05, 260); },
    lane() { tone(220, 0.05, 'square', 0.015); },
    level() { tone(523, 0.12, 'triangle', 0.06); setTimeout(() => tone(784, 0.2, 'triangle', 0.06), 110); },
    crash() { tone(180, 0.5, 'sawtooth', 0.09, -140); },
  };
})();
const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch (e) {} };

/* ── game state ────────────────────────────────────────── */
const ui = {
  score: $('#score'), best: $('#best'),
  start: $('#startScreen'), pause: $('#pauseScreen'), over: $('#overScreen'),
  finalScore: $('#finalScore'), finalBest: $('#finalBest'), newBest: $('#newBest'),
  quip: $('#quip'), kicker: $('#overKicker'), flash: $('#flash'),
  combo: $('#combo'), toast: $('#toast'), mute: $('#muteBtn'), share: $('#shareBtn'), hint: $('#hint'),
};

let best = 0;
try { best = parseInt(localStorage.getItem('pipeline-runner-best') || '0', 10) || 0; } catch (e) {}
ui.best.textContent = best;

const state = {
  mode: 'menu',               // menu | run | paused | over
  lane: 1, x: 0, y: BASE_Y, vy: 0,
  speed: START_SPEED, distance: 0, records: 0,
  nextRowAt: 40, time: 0, shake: 0, tilt: 0,
  combo: 1, comboTimer: 0, level: 1, bonus: 0, maxCombo: 1,
};

function score() { return Math.floor(state.distance / 2) + state.bonus; }

function reset() {
  while (live.length) recycle(live.length - 1);
  Object.assign(state, {
    lane: 1, x: 0, y: BASE_Y, vy: 0, speed: START_SPEED, distance: 0, records: 0,
    nextRowAt: 40, time: 0, shake: 0, tilt: 0,
    combo: 1, comboTimer: 0, level: 1, bonus: 0, maxCombo: 1,
  });
  ui.combo.hidden = true;
  // prefill the track so the first seconds aren't empty
  for (let z = -40; z > SPAWN_Z; z -= 18) spawnRow(z, 0);
  player.visible = true;
  ui.score.textContent = '0';
}

function show(el, on) { el.hidden = !on; }

let toastTimer;
function toast(title, sub) {
  ui.toast.innerHTML = `${title}<small>${sub}</small>`;
  ui.toast.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('is-on'), 1400);
}
const LEVELS = ['', '', 'Throughput up', 'Peak traffic', 'Black Friday', 'Viral spike', 'Full firehose'];

let hintTimer;
function hideHint() { ui.hint.classList.remove('is-on'); clearTimeout(hintTimer); }
function showHint() {
  let runs = 0;
  try { runs = parseInt(localStorage.getItem('pipeline-runner-runs') || '0', 10) || 0; localStorage.setItem('pipeline-runner-runs', String(runs + 1)); } catch (e) {}
  if (runs >= 3) return;
  ui.hint.classList.add('is-on');
  hintTimer = setTimeout(hideHint, 5000);
}

function start() {
  sound.unlock();
  reset();
  showHint();
  state.mode = 'run';
  show(ui.start, false); show(ui.over, false); show(ui.pause, false);
  canvas.focus?.();
}

function pause(on) {
  if (on && state.mode === 'run') { state.mode = 'paused'; hideHint(); show(ui.pause, true); $('#resumeBtn').focus(); }
  else if (!on && state.mode === 'paused') { state.mode = 'run'; show(ui.pause, false); last = performance.now(); }
}

function gameOver() {
  state.mode = 'over';
  hideHint();
  fireBurst(player.position, COLORS.coral, 1.3);
  player.visible = false;
  state.shake = 0.6;
  sound.crash();
  buzz([60, 40, 90]);
  ui.flash.classList.add('is-on');
  requestAnimationFrame(() => ui.flash.classList.remove('is-on'));
  const s = score();
  const isBest = s > best;
  if (isBest) {
    best = s;
    try { localStorage.setItem('pipeline-runner-best', String(best)); } catch (e) {}
  }
  ui.best.textContent = best;
  ui.finalScore.textContent = s;
  ui.finalBest.textContent = best;
  ui.newBest.hidden = !isBest;
  ui.kicker.textContent = `Packet dropped at ${Math.floor(state.distance)} m`;
  ui.quip.innerHTML = QUIPS[Math.floor(Math.random() * QUIPS.length)];
  prepareSubmit({ score: s, distance: state.distance, records: state.records, duration: state.time });
  lastRun = { score: s, best, distance: state.distance, records: state.records, level: state.level, maxCombo: state.maxCombo };
  if (challenge) {
    ui.kicker.textContent = s > challenge.score
      ? `You beat ${challenge.by}'s ${challenge.score.toLocaleString('en-US')}!`
      : `${(challenge.score - s + 1).toLocaleString('en-US')} short of ${challenge.by}'s ${challenge.score.toLocaleString('en-US')}`;
  }
  setTimeout(() => {
    if (state.mode !== 'over') return;
    snapshot();
    show(ui.over, true); $('#againBtn').focus();
  }, 750);
}

/* ── leaderboard ───────────────────────────────────────── */
const lb = {
  form: $('#submitForm'), input: $('#playerName'), btn: $('#submitBtn'), status: $('#submitStatus'),
  screen: $('#boardScreen'), list: $('#boardList'), note: $('#boardNote'),
  run: null, submitted: null, returnTo: null,
};
try { lb.input.value = localStorage.getItem('pipeline-runner-name') || ''; } catch (e) {}

function setStatus(msg, kind) {
  lb.status.textContent = msg;
  lb.status.className = 'submit__status' + (kind ? ' is-' + kind : '');
}

function prepareSubmit(run) {
  lb.run = run;
  lb.submitted = null;
  lb.btn.disabled = false;
  lb.input.disabled = false;
  setStatus('');
  lb.form.hidden = run.score < 1;
  showOverBoard(run);
}

/* the game-over screen shows the board straight away, with this run placed on it */
const overBoard = { list: $('#overBoard'), note: $('#overBoardNote') };
async function showOverBoard(run) {
  overBoard.list.replaceChildren();
  overBoard.note.textContent = 'Loading the leaderboard…';
  const b = await fetchBoard(50);
  if (lb.run !== run) return;                       // a newer run already replaced this one
  // if the leaderboard is unreachable (e.g. the free database is paused), don't offer to submit
  if (!b.online) lb.form.hidden = true;
  if (lb.submitted) {
    renderBoard(overBoard.list, placeSaved(b, lb.submitted.name, 8), lb.submitted);
  } else {
    const rows = placeRun(b, run.score, 8);
    renderBoard(overBoard.list, rows);
    const you = rows.find((r) => r.pending);
    const beaten = b.rows.filter((r) => r.score < run.score);
    overBoard.note.textContent = !b.online
      ? 'Live scores are offline right now, so only the bots are showing.'
      : run.score < 1 ? ''
      : `You'd be #${you.rank}${beaten.length ? `, ahead of ${beaten[0].name}` : ''}. Add your name to save it.`;
    return;
  }
  overBoard.note.textContent = `Saved: #${lb.submitted.rank} of ${lb.submitted.total} players worldwide, ranked by each player's best run (bots don't count).`;
}

lb.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!lb.run || lb.submitted) return;
  const name = lb.input.value.trim().replace(/\s+/g, ' ');
  if (!/^[\p{L}\p{N} ._'-]{2,16}$/u.test(name)) { setStatus('Use 2–16 letters, numbers or spaces.', 'bad'); lb.input.focus(); return; }
  lb.btn.disabled = true;
  setStatus('Submitting…');
  try {
    const r = await submitRun({ ...lb.run, name });
    lb.submitted = { name, score: lb.run.score, rank: r.rank, total: r.total };
    try { localStorage.setItem('pipeline-runner-name', name); } catch (err) {}
    lb.input.disabled = true;
    setStatus(r.total > 1 ? `Saved. You're #${r.rank} of ${r.total} players.` : 'Saved. You\'re the first on the board!', 'ok');
    showOverBoard(lb.run);
  } catch (err) {
    lb.btn.disabled = false;
    setStatus(err.message, 'bad');
  }
});

async function openBoard() {
  lb.returnTo = !ui.over.hidden ? ui.over : (!ui.start.hidden ? ui.start : null);
  if (lb.returnTo) show(lb.returnTo, false);
  show(lb.screen, true);
  lb.note.textContent = 'Loading…';
  lb.list.replaceChildren();
  $('#closeBoard').focus();
  const b = await fetchBoard(10);
  renderBoard(lb.list, b.rows, lb.submitted);
  lb.note.textContent = !b.online
    ? 'Live scores are offline right now, so only the bots are showing.'
    : b.players === 0 ? 'No human runs yet. Beat a bot and claim the top spot.'
    : 'BOT rows are built-in rivals. Everyone else played this page.';
}
function closeBoard() {
  show(lb.screen, false);
  if (lb.returnTo) { show(lb.returnTo, true); lb.returnTo.querySelector('button')?.focus(); }
}
document.querySelectorAll('[data-open-board]').forEach((b) => b.addEventListener('click', openBoard));
$('#closeBoard').addEventListener('click', closeBoard);

/* ── input ─────────────────────────────────────────────── */
function move(dir) {
  if (state.mode !== 'run') return;
  hideHint();
  const next = Math.max(0, Math.min(2, state.lane + dir));
  if (next !== state.lane) { state.lane = next; state.tilt = -dir * 0.5; sound.lane(); }
}
function jump() {
  if (state.mode !== 'run') return;
  hideHint();
  if (state.y <= BASE_Y + 0.01) { state.vy = JUMP_V; sound.jump(); }
}
function drop() {
  if (state.mode === 'run' && state.y > BASE_Y + 0.05) state.vy = -JUMP_V * 1.8;
}

window.addEventListener('keydown', (e) => {
  const k = e.key;
  // typing a name must not steer, restart or mute the game
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (!lb.screen.hidden) { if (k === 'Escape') closeBoard(); return; }
  if (!sh.screen.hidden) { if (k === 'Escape') closeShare(); return; }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (state.mode === 'menu' || state.mode === 'over') {
    if ((k === 'Enter' || k === ' ') && !e.repeat && document.activeElement?.tagName !== 'A') {
      if (state.mode === 'menu' || !ui.over.hidden) start();
    }
    return;
  }
  if (k === 'm' || k === 'M') { sound.toggle(); syncMute(); return; }
  if (k === 'p' || k === 'P' || k === 'Escape') { pause(state.mode === 'run'); return; }
  if (state.mode !== 'run' || e.repeat) return;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') move(-1);
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') move(1);
  else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') jump();
  else if (k === 'ArrowDown' || k === 's' || k === 'S') drop();
});

/* touch: swipe anywhere, or the on-screen buttons */
let touchStart = null;
function markTouch() { document.body.classList.add('is-touch'); }
if (matchMedia('(pointer: coarse)').matches) markTouch();
canvas.addEventListener('touchstart', (e) => {
  markTouch();
  const t = e.changedTouches[0];
  touchStart = { x: t.clientX, y: t.clientY, time: performance.now() };
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x, dy = t.clientY - touchStart.y;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (Math.max(ax, ay) < 24) jump();           // tap = jump
  else if (ax > ay) move(dx > 0 ? 1 : -1);
  else if (dy < 0) jump(); else drop();
  touchStart = null;
}, { passive: true });
document.querySelectorAll('.touch [data-act]').forEach((b) => {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const a = b.dataset.act;
    if (a === 'left') move(-1); else if (a === 'right') move(1); else jump();
  });
});

$('#startBtn').addEventListener('click', start);
$('#againBtn').addEventListener('click', start);
$('#resumeBtn').addEventListener('click', () => pause(false));
$('#pauseBtn').addEventListener('click', (e) => { pause(true); e.currentTarget.blur(); });

function syncMute() {
  ui.mute.setAttribute('aria-pressed', String(sound.muted));
  ui.mute.setAttribute('aria-label', sound.muted ? 'Unmute sound' : 'Mute sound');
}
ui.mute.addEventListener('click', (e) => { sound.toggle(); syncMute(); e.currentTarget.blur(); });
syncMute();

/* ── brag card + challenge link ────────────────────────── */
let lastRun = null;
const snap = document.createElement('canvas');
function snapshot() {
  // WebGL clears its buffer after compositing, so render and copy in the same task
  renderer.render(scene, camera);
  snap.width = canvas.width; snap.height = canvas.height;
  snap.getContext('2d').drawImage(canvas, 0, 0);
}

const sh = {
  screen: $('#shareScreen'), img: $('#cardPreview'), native: $('#nativeShare'), download: $('#downloadCard'),
  copy: $('#copyLink'), x: $('#shareX'), li: $('#shareIn'), note: $('#shareNote'), blob: null, url: '', text: '',
};

async function openShare() {
  if (!lastRun) return;
  const name = lb.submitted?.name || (lb.input.value.trim() || '');
  const run = { ...lastRun, name, rank: lb.submitted?.rank, total: lb.submitted?.total };
  const card = drawCard(run, snap);
  sh.blob = await cardToBlob(card);
  if (sh.img.src.startsWith('blob:')) URL.revokeObjectURL(sh.img.src);
  sh.img.src = URL.createObjectURL(sh.blob);
  sh.img.alt = `Pipeline Runner result card: ${run.score} points`;
  sh.download.href = sh.img.src;

  sh.url = challengeUrl(run.score, name);
  const place = run.rank && run.total ? ` (#${run.rank} of ${run.total} worldwide)` : '';
  sh.text = `I just scored ${run.score.toLocaleString('en-US')} on Pipeline Runner${place}, a 3D game on Amanuel Teferi's portfolio. Think you can beat it?`;
  sh.x.href = 'https://x.com/intent/post?' + new URLSearchParams({ text: sh.text, url: sh.url });
  sh.li.href = 'https://www.linkedin.com/sharing/share-offsite/?' + new URLSearchParams({ url: sh.url });
  sh.copy.textContent = 'Copy challenge link';

  const file = new File([sh.blob], 'pipeline-runner-score.png', { type: 'image/png' });
  sh.native.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  sh.native.onclick = async () => {
    try { await navigator.share({ files: [file], title: 'Pipeline Runner', text: `${sh.text} ${sh.url}` }); }
    catch (e) { /* cancelled */ }
  };
  sh.note.textContent = name
    ? `The link opens the game with ${run.score.toLocaleString('en-US')} as the score to beat.`
    : !lb.form.hidden ? 'Tip: submit your name to the leaderboard first and the card shows it, with your world rank.'
    : 'The link opens the game with your score as the one to beat.';

  show(ui.over, false);
  show(sh.screen, true);
  (sh.native.hidden ? sh.download : sh.native).focus();
}
function closeShare() { show(sh.screen, false); show(ui.over, true); ui.share.focus(); }

ui.share.addEventListener('click', openShare);
$('#closeShare').addEventListener('click', closeShare);
sh.copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(`${sh.text} ${sh.url}`); sh.copy.textContent = 'Copied!'; }
  catch (e) { sh.copy.textContent = 'Copy failed'; }
  setTimeout(() => { sh.copy.textContent = 'Copy challenge link'; }, 1800);
});

/* arriving from someone's challenge link */
const challenge = readChallenge();
if (challenge) {
  const el = $('#challenge');
  el.textContent = `🏁 ${challenge.by} challenged you: beat ${challenge.score.toLocaleString('en-US')}`;
  el.hidden = false;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });
window.addEventListener('blur', () => pause(true));

/* ── resize ────────────────────────────────────────────── */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // pull the camera back on narrow screens so all three lanes stay visible
  camera.fov = w / h < 0.75 ? 78 : 62;
  CAM_BASE.z = w / h < 0.75 ? 8.2 : 7.2;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/* ── loop ──────────────────────────────────────────────── */
const tmp = new THREE.Vector3();
let last = performance.now();

function update(dt) {
  const running = state.mode === 'run';
  const speed = running ? state.speed : (state.mode === 'menu' ? 8 : 0);

  if (running) {
    state.time += dt;
    state.speed = Math.min(MAX_SPEED, state.speed + ACCEL * dt);
    state.distance += speed * dt;

    // lateral + vertical motion
    const tx = LANES[state.lane];
    state.x += (tx - state.x) * Math.min(1, dt * 14);
    state.vy -= GRAVITY * dt;
    state.y = Math.max(BASE_Y, state.y + state.vy * dt);
    if (state.y === BASE_Y) state.vy = Math.max(0, state.vy);

    // spawn rows, closer together as you speed up
    state.nextRowAt -= speed * dt;
    if (state.nextRowAt <= 0) {
      const difficulty = (state.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
      spawnRow(SPAWN_Z, difficulty);
      state.nextRowAt = THREE.MathUtils.lerp(26, 15, difficulty) + Math.random() * 6;
    }
    ui.score.textContent = score();

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) { state.combo = 1; ui.combo.hidden = true; }
    }
    const level = 1 + Math.floor(state.distance / 400);
    if (level > state.level) {
      state.level = level;
      toast(`Level ${level}`, LEVELS[Math.min(level, LEVELS.length - 1)] || 'Keep going');
      sound.level();
    }
  }

  // world scroll
  floorTex.offset.y += (speed * dt) / 6;
  for (const r of rings) {
    r.position.z += speed * dt;
    if (r.position.z > DESPAWN_Z) r.position.z -= rings.length * 9;
  }
  for (let i = 0; i < STREAKS; i++) {
    streakPos[i * 3 + 2] += speed * dt * 1.6;
    if (streakPos[i * 3 + 2] > DESPAWN_Z) resetStreak(i, SPAWN_Z + Math.random() * 20);
  }
  streakGeo.attributes.position.needsUpdate = true;

  // obstacles
  for (let i = live.length - 1; i >= 0; i--) {
    const m = live[i];
    m.position.z += speed * dt;
    const t = m.userData.type;
    if (t === 'record') { m.rotation.y += dt * 3; m.position.y += Math.sin(state.time * 5 + m.userData.phase) * 0.004; }
    else if (t === 'bug') { m.children[1].rotation.y += dt * 1.5; }

    if (running && m.visible) {
      const s = m.userData.size;
      const dz = Math.abs(m.position.z - 0);
      const dx = Math.abs(m.position.x - state.x);
      if (dz < s.d / 2 + RADIUS * 0.8 && dx < s.w / 2 + RADIUS * 0.6) {
        const bottom = state.y - RADIUS;
        if (t === 'record') {
          if (Math.abs(m.position.y - state.y) < 0.9) {
            state.records++;
            state.combo = state.comboTimer > 0 ? Math.min(5, state.combo + 1) : 1;
            state.maxCombo = Math.max(state.maxCombo, state.combo);
            state.comboTimer = 1.6;
            state.bonus += RECORD_POINTS * state.combo;
            m.visible = false;
            fireBurst(m.position, COLORS.acid, 0.4);
            sound.pickup(state.combo);
            if (state.combo > 1) {
              ui.combo.textContent = `×${state.combo}`;
              ui.combo.hidden = false;
              ui.combo.classList.remove('pop'); void ui.combo.offsetWidth; ui.combo.classList.add('pop');
            }
          }
        } else if (bottom < s.h - 0.05) {
          gameOver();
        }
      }
    }
    if (m.position.z > DESPAWN_Z) recycle(i);
  }

  // packet
  player.position.set(state.x, state.y, 0);
  core.rotation.x -= dt * (2 + speed * 0.15);
  core.rotation.y += dt * 1.2;
  shell.rotation.y -= dt * 0.8;
  state.tilt += (0 - state.tilt) * Math.min(1, dt * 8);
  player.rotation.z = state.tilt;
  shadow.position.x = state.x;
  const air = (state.y - BASE_Y) / 2;
  shadow.scale.setScalar(Math.max(0.4, 1 - air));
  shadow.material.opacity = Math.max(0.1, 0.45 - air * 0.3);

  // burst
  if (burstLife > 0) {
    burstLife = Math.max(0, burstLife - dt * 1.4);
    for (let i = 0; i < BURST; i++) {
      burstVel[i * 3 + 1] -= 9 * dt;
      burstPos[i * 3] += burstVel[i * 3] * dt;
      burstPos[i * 3 + 1] = Math.max(0.05, burstPos[i * 3 + 1] + burstVel[i * 3 + 1] * dt);
      burstPos[i * 3 + 2] += burstVel[i * 3 + 2] * dt + speed * dt;
    }
    burstGeo.attributes.position.needsUpdate = true;
  }
  burstMat.opacity = burstLife;

  // camera follows loosely, with shake on crash
  state.shake = Math.max(0, state.shake - dt);
  tmp.set(state.x * 0.45, CAM_BASE.y + (state.y - BASE_Y) * 0.25, CAM_BASE.z);
  camera.position.lerp(tmp, Math.min(1, dt * 5));
  if (state.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * state.shake * 0.8;
    camera.position.y += (Math.random() - 0.5) * state.shake * 0.8;
  }
  camera.lookAt(state.x * 0.3, 0.6, -12);
  const targetFov = (camera.aspect < 0.75 ? 78 : 62) + (running ? (state.speed - START_SPEED) * 0.25 : 0);
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 2);
    camera.updateProjectionMatrix();
  }
}

/* adaptive quality: if frames run slow for a couple of seconds, render at a lower resolution */
let perfWindow = 0, perfFrames = 0, pixelRatio = renderer.getPixelRatio();
function adapt(dt) {
  perfWindow += dt; perfFrames++;
  if (perfWindow < 2) return;
  const fps = perfFrames / perfWindow;
  perfWindow = 0; perfFrames = 0;
  if (fps < 45 && pixelRatio > 0.75) {
    pixelRatio = Math.max(0.75, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
    resize();
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === 'run') adapt((now - (frame.prev || now)) / 1000);
  frame.prev = now;
  if (state.mode !== 'paused') update(dt);
  document.body.classList.toggle('is-running', state.mode === 'run');
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// a gently moving track behind the start screen
for (let z = -30; z > SPAWN_Z; z -= 20) spawnRow(z, 0);
requestAnimationFrame(frame);

// expose a tiny hook for automated smoke tests
window.__pipelineRunner = { state, start, score, spawn };
