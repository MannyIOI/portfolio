/* ═══════════════════════════════════════════════════════════
   Pipeline Runner — brag cards and challenge links.
   Draws a 1200×630 result card (score, name, rank, stats and a
   snapshot of the crash) and builds a link that challenges the
   next player to beat that score.
   ═══════════════════════════════════════════════════════════ */
const W = 1200, H = 630;
const C = { ink: '#08080c', ink2: '#0d0d14', bone: '#f2efe8', dim: '#a8a49b', acid: '#d7ff3e', violet: '#6e4bff', coral: '#ff5a3c', cyan: '#35e7ff' };
const DISPLAY = "800 1px 'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";
const MONO = "500 1px 'JetBrains Mono', ui-monospace, Menlo, monospace";

const font = (tpl, px) => tpl.replace('1px', px + 'px');

/** Link that opens the game with a challenge banner for this run. */
export function challengeUrl(score, name) {
  const u = new URL('play.html', location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('beat', String(score));
  if (name) u.searchParams.set('by', name.slice(0, 16));
  return u.href;
}

/** Reads ?beat=&by= from the current URL. Returns null when there's no valid challenge. */
export function readChallenge() {
  const p = new URLSearchParams(location.search);
  const score = parseInt(p.get('beat') || '', 10);
  if (!Number.isFinite(score) || score < 1 || score > 500000) return null;
  const by = (p.get('by') || '').replace(/[^\p{L}\p{N} ._'-]/gu, '').trim().slice(0, 16);
  return { score, by: by || 'A friend' };
}

/**
 * Draws the result card.
 * run: { score, best, distance, records, level, maxCombo, name, rank, total }
 * snapshot: a canvas with the last frame of the game (optional)
 */
export function drawCard(run, snapshot) {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  g.fillStyle = C.ink; g.fillRect(0, 0, W, H);

  // gameplay snapshot on the right, faded into the background
  if (snapshot && snapshot.width) {
    const sw = snapshot.width, sh = snapshot.height;
    const scale = Math.max(700 / sw, H / sh);
    const dw = sw * scale, dh = sh * scale;
    g.drawImage(snapshot, W - dw + (dw - 700) / 2, (H - dh) / 2, dw, dh);
  }
  const fade = g.createLinearGradient(0, 0, W, 0);
  fade.addColorStop(0, 'rgba(8,8,12,1)'); fade.addColorStop(0.46, 'rgba(8,8,12,1)');
  fade.addColorStop(0.62, 'rgba(8,8,12,0.55)'); fade.addColorStop(1, 'rgba(8,8,12,0.1)');
  g.fillStyle = fade; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(180, 120, 10, 180, 120, 520);
  glow.addColorStop(0, 'rgba(110,75,255,0.30)'); glow.addColorStop(1, 'rgba(110,75,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);

  const x = 72;
  g.textBaseline = 'alphabetic';

  // kicker
  g.fillStyle = C.acid; g.font = font(MONO, 20);
  g.fillText('PIPELINE RUNNER · 3D', x, 92);

  // who
  const who = run.name ? run.name.toUpperCase() : 'MY RUN';
  g.fillStyle = C.bone; g.font = font(DISPLAY, 44);
  g.fillText(clip(g, who + ' SCORED', 560), x, 160);

  // the score
  g.font = font(DISPLAY, 168);
  const scoreText = run.score.toLocaleString('en-US');
  const sg = g.createLinearGradient(x, 0, x + g.measureText(scoreText).width, 0);
  sg.addColorStop(0, C.bone); sg.addColorStop(0.55, C.acid); sg.addColorStop(1, C.cyan);
  g.fillStyle = sg;
  g.fillText(scoreText, x - 6, 318);

  // badges
  let bx = x;
  const badge = (text, color) => {
    g.font = font(MONO, 20);
    const w = g.measureText(text).width + 36;
    roundRect(g, bx, 350, w, 44, 22);
    g.fillStyle = color === C.acid ? C.acid : 'rgba(242,239,232,0.06)'; g.fill();
    g.strokeStyle = color === C.acid ? C.acid : 'rgba(242,239,232,0.2)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = color === C.acid ? C.ink : color; g.fillText(text, bx + 18, 379);
    bx += w + 12;
  };
  if (run.rank && run.total) badge(`#${run.rank} OF ${run.total} WORLDWIDE`, C.acid);
  if (run.score >= run.best && run.score > 0) badge('NEW PERSONAL BEST', C.bone);

  // stats row
  const stats = [
    [`${Math.floor(run.distance).toLocaleString('en-US')} m`, 'DISTANCE'],
    [String(run.records), 'RECORDS'],
    [`×${run.maxCombo || 1}`, 'BEST COMBO'],
    [`LV ${run.level || 1}`, 'REACHED'],
  ];
  stats.forEach(([v, k], i) => {
    const sx = x + i * 142;
    g.fillStyle = C.bone; g.font = font(DISPLAY, 38); g.fillText(v, sx, 478);
    g.fillStyle = C.dim; g.font = font(MONO, 15); g.fillText(k, sx, 504);
  });

  // footer
  g.fillStyle = 'rgba(242,239,232,0.12)'; g.fillRect(x, 548, 540, 1);
  g.fillStyle = C.bone; g.font = font(MONO, 20);
  g.fillText('Think you can beat it?', x, 588);
  g.fillStyle = C.dim; g.font = font(MONO, 16);
  g.fillText(prettyHost(), x + 300, 588);

  return cv;
}

function prettyHost() {
  const u = new URL('play.html', location.href);
  return (u.host + u.pathname).replace(/^www\./, '').slice(0, 40);
}

function clip(g, text, max) {
  if (g.measureText(text).width <= max) return text;
  while (text.length > 1 && g.measureText(text + '…').width > max) text = text.slice(0, -1);
  return text + '…';
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export const cardToBlob = (cv) => new Promise((res) => cv.toBlob(res, 'image/png'));
