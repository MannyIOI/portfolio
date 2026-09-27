/* ═══════════════════════════════════════════════════════════
   Pipeline Runner leaderboard — Supabase RPCs, no SDK.
   The scores table is private; the browser can only call
   get_top_scores() and submit_score(), which validates each run
   against the game's rules and rate-limits per visitor.
   Bots are clearly labelled rivals so the board is never empty.
   ═══════════════════════════════════════════════════════════ */
const API = 'https://ehvhpcyibqeuxymetcsi.supabase.co/rest/v1/rpc/';
// publishable key: safe to ship in the browser, it only reaches the two functions above
const KEY = 'sb_publishable_BpMFVNjNWIbFA1U4wAycXw_TIiRnegt';

/** Same rule as the database's name_key(): letters and digits only, case-insensitive. */
export const nameKey = (n) => String(n || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const BOTS = [
  { name: 'The Firewall', score: 1800, bot: true },
  { name: 'Latency Larry', score: 1100, bot: true },
  { name: 'Packet Pete', score: 650, bot: true },
  { name: 'Null Pointer', score: 300, bot: true },
];

async function rpc(fn, body, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(API + fn, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error((data && data.message) || `HTTP ${res.status}`);
      err.code = data && data.message;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

/** Top real scores (one row per name, its best run) merged with the bots, best first. `online` is false if the API is unreachable. */
export async function fetchBoard(limit = 10) {
  try {
    const rows = await rpc('get_top_scores', { max_rows: limit });
    const players = (Array.isArray(rows) ? rows : []).map((r) => ({ name: String(r.name), score: Number(r.score), bot: false }));
    return { online: true, players: players.length, rows: merge(players, limit) };
  } catch (e) {
    return { online: false, players: 0, rows: merge([], limit) };
  }
}

function merge(players, limit) {
  return [...players, ...BOTS].sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Submit a finished run. Resolves to { rank, total } among real players, or throws with a readable message. */
export async function submitRun({ name, score, distance, records, duration }) {
  try {
    const rows = await rpc('submit_score', {
      p_name: name, p_score: score, p_distance: Math.floor(distance),
      p_records: records, p_duration_s: Math.round(duration * 100) / 100,
    });
    const r = Array.isArray(rows) ? rows[0] : rows;
    return { rank: Number(r.rank), total: Number(r.total) };
  } catch (e) {
    const code = e.code || e.message || '';
    if (code.includes('invalid_name')) throw new Error('Use 2–16 letters, numbers or spaces.');
    if (code.includes('rate_limited')) throw new Error('Too many submissions — try again in a few minutes.');
    if (code.includes('implausible_run')) throw new Error('That run didn\'t check out, so it wasn\'t saved.');
    throw new Error('Couldn\'t reach the leaderboard right now.');
  }
}

/**
 * Places an unsaved run on the board: top `limit` rows with a "You" row at its rank.
 * If the run falls outside them, the list ends with a gap and the run at its real position.
 * `board` should come from fetchBoard() with a larger limit (e.g. 50) so the rank is accurate.
 */
export function placeRun(board, score, limit = 8) {
  const all = board.rows.map((r) => ({ ...r }));
  let rank = all.filter((r) => r.score >= score).length + 1;
  const you = { name: 'You', score, bot: false, pending: true };
  const sorted = [...all];
  sorted.splice(rank - 1, 0, you);
  sorted.forEach((r, i) => { r.rank = i + 1; });
  if (rank <= limit) return sorted.slice(0, limit);
  const overflow = rank > all.length && all.length >= 50;   // beyond what we fetched
  return [...sorted.slice(0, limit - 1), { gap: true }, { ...you, rank: overflow ? '50+' : rank }];
}

/** The board after saving: top `limit` rows, and the saved name's row after a gap if it's further down. */
export function placeSaved(board, name, limit = 8) {
  const rows = board.rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const idx = rows.findIndex((r) => !r.bot && nameKey(r.name) === nameKey(name));
  if (idx < 0 || idx < limit) return rows.slice(0, limit);
  return [...rows.slice(0, limit - 1), { gap: true }, rows[idx]];
}

/** Render rows into an <ol> with text nodes only (names come from other visitors). */
export function renderBoard(ol, rows, highlight) {
  ol.replaceChildren();
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    if (r.gap) { li.className = 'is-gap'; li.textContent = '···'; li.setAttribute('aria-hidden', 'true'); ol.append(li); return; }
    if (r.bot) li.className = 'is-bot';
    if (r.pending) li.classList.add('is-you', 'is-pending');
    // one row per name (their best run), so match on the name, not this run's score
    if (highlight && !r.bot && !r.pending && nameKey(r.name) === nameKey(highlight.name)) li.classList.add('is-you');
    const rank = document.createElement('span'); rank.className = 'lb__rank';
    rank.textContent = typeof r.rank === 'string' ? r.rank : String(r.rank || i + 1).padStart(2, '0');
    const name = document.createElement('span'); name.className = 'lb__name'; name.textContent = r.name;
    if (r.bot) { const tag = document.createElement('i'); tag.textContent = 'BOT'; name.append(' ', tag); }
    if (r.pending) { const tag = document.createElement('i'); tag.textContent = 'NOT SAVED'; name.append(' ', tag); }
    const score = document.createElement('span'); score.className = 'lb__score'; score.textContent = r.score.toLocaleString('en-US');
    li.append(rank, name, score);
    ol.append(li);
  });
}
