import { STORY, ROOMS, OFFICE, ENDING, SAFE_CODE, TEACHER_CODE, CIPHER, CIPHER_MSG, XWORD, MEMO } from './data.js?v=7';
import * as SND from './audio.js?v=2';
const AVA = { shai: 'שי', alma: 'אלמה', noga: 'המורה נוגה' };
const avaImg = who => `<img src="img/ava-${who}.webp" alt="${AVA[who]}" width="80" height="80">`;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); } if (html) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const roomById = id => ROOMS.find(r => r.id === id);

/* ---------------- מצב ושמירה ---------------- */
const KEY = 'soc_escape_v1';
// קצב הזמנים במשחק (ברירת מחדל: זמנים אמיתיים)
const TS = /[?&]fast=1(&|$)/.test(location.search) ? 0.1 : 1;
const HINT1_MS = 45000 * TS, HINT2_MS = 30000 * TS, COOL_MS = 15000 * TS, PEN_MS = 60000, PEEK_MS = 6000 * (TS < 1 ? 0.3 : 1);
const fresh = () => ({ v: 1, group: '', timer: { mode: 'stopwatch', minutes: 45 }, started: 0, finishMs: 0, solved: [], words: ['', '', '', '', ''], clues: {}, hints: {}, step: {}, timeUpShown: false, seen: [], enter: {}, hintT: {}, wrong: {}, cool: {} });
let S = load();
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(fresh(), s); } catch (e) { } return fresh(); }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
let TEACHER = sessionStorage.getItem('se_teacher') === '1';
const isSolved = id => S.solved.includes(id);
const isOpen = id => TEACHER || id === 'class' || (id === 'office' ? ROOMS.every(r => isSolved(r.id)) : isSolved(ROOMS[roomById(id).n - 2].id));
const found = (rid, cid) => (S.clues[rid] || []).includes(cid);
function markFound(rid, cid) { S.clues[rid] = S.clues[rid] || []; if (!S.clues[rid].includes(cid)) { S.clues[rid].push(cid); save(); SND.sfx('clue'); } refreshMarkers(); renderPanel(); }
const spot = id => id === 'office' ? OFFICE : roomById(id);
const cl4 = id => spot(id).clues.filter(c => !c.gate);
const cluesDone = id => cl4(id).every(c => found(id, c.id));
const isGateSpot = (v, id) => v !== 'hub' && v !== 'office' && !!(spot(v).clues.find(c => c.id === id) || {}).gate;
const allFound = id => spot(id).clues.every(c => found(id, c.id));

/* ---------------- נרמול תשובות ---------------- */
const FIN = { 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' };
export const norm = s => String(s).toLowerCase().replace(/[\u0591-\u05C7]/g, '').replace(/[םןץףך]/g, c => FIN[c]).replace(/^\s*the\s+/, '').replace(/[^a-z\u05d0-\u05ea]/g, '').replace(/ה/g, '');
const nl = s => String(s).trim().replace(/[םןץףך]/g, c => FIN[c]);
function lev(a, b) { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
export function accepts(input, list) { const x = norm(input); if (!x) return false; return list.some(a => { const y = norm(a); if (x === y) return true; if (y.length >= 5 && x.includes(y)) return true; const tol = y.length >= 10 ? 2 : y.length >= 6 ? 1 : 0; return lev(x, y) <= tol; }); }

/* ---------------- טיימר ---------------- */
const fmt = ms => { const neg = ms < 0; ms = Math.abs(ms); const t = Math.floor(ms / 1000), m = Math.floor(t / 60), s = t % 60; return (neg ? '+' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); };
const elapsed = () => S.started ? ((S.finishMs || Date.now()) - S.started) : 0;
const penalty = () => totalHints() * PEN_MS;
const gameMs = () => elapsed() + penalty();
function tickTimer() {
  const el = $('#timer'); if (!el) return;
  const mode = S.timer.mode;
  if (mode === 'none' || !S.started) { el.hidden = true; return; } el.hidden = false;
  if (mode === 'stopwatch') { el.textContent = '⏱ ' + fmt(gameMs()); el.classList.remove('late', 'warn'); return; }
  const left = S.timer.minutes * 60000 - gameMs();
  if (left > 0) { el.textContent = '⏳ ' + fmt(left); el.classList.toggle('warn', left < 60000); el.classList.remove('late'); return; }
  el.textContent = '⏳ +' + fmt(-left); el.classList.add('late');
  if (!S.timeUpShown && !S.finishMs && !$('#game').hidden) { S.timeUpShown = true; save(); openModal({ title: '⏰ הזמן נגמר!', html: '<p class="big">הזמן שהמורה קבעה נגמר.</p><p>אבל סוציולוגים טובים לא מוותרים – אפשר להמשיך ולפתור. השעון ימשיך לספור כמה זמן עבר מעבר לזמן.</p>', buttons: [{ t: 'ממשיכים 💪', primary: true }] }); }
}
setInterval(tickTimer, 1000);

/* ---------------- מודאל ---------------- */
let modalClose = null, modalAt = 0;
function openModal({ title, html = '', node = null, wide = false, buttons = [], onClose = null, cls = '' }) {
  const m = $('#modal'), body = $('#mbody');
  $('#mtitle').textContent = title || '';
  body.innerHTML = html; if (node) body.appendChild(node);
  const bb = h('div', { class: 'mbtns' });
  buttons.forEach(b => bb.appendChild(h('button', { class: 'btn ' + (b.primary ? 'primary' : 'ghost'), onclick: () => { if (b.fn) { if (b.fn() === false) return; } if (!b.keep) closeModal(); } }, b.t)));
  if (buttons.length) body.appendChild(bb);
  $('#mcard').className = 'mcard ' + (wide ? 'wide ' : '') + cls;
  m.hidden = false; modalClose = onClose; body.scrollTop = 0; modalAt = performance.now();
  requestAnimationFrame(() => { const f = body.querySelector('input,button'); if (f && matchMedia('(pointer:fine)').matches) f.focus({ preventScroll: true }); });
}
function closeModal() { const m = $('#modal'); if (m.hidden) return; m.hidden = true; $('#mbody').innerHTML = ''; const f = modalClose; modalClose = null; if (f) f(); }
let toastT = 0;
function toast(t, ms = 2600) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms); }
function wrongFx(el, msg = 'נסו שוב 🙂') { SND.sfx('wrong'); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); } const f = $('#mbody .feedback'); if (f) { f.className = 'feedback bad'; f.textContent = msg; } }
function okFx(msg) { SND.sfx('ok'); const f = $('#mbody .feedback'); if (f) { f.className = 'feedback good'; f.textContent = msg; } }

/* ---------------- רמזים ---------------- */
function hintInfo(key, hints) {
  const n = S.hints[key] || 0, now = Date.now();
  if (n >= hints.length) return { n, done: true };
  if (TEACHER) return { n, ready: true };
  if (n === 0) { const at = (S.enter[key] || now) + HINT1_MS; return at <= now ? { n, ready: true } : { n, wait: at - now }; }
  if (n === 1) { const at = ((S.hintT[key] || [])[0] || now) + HINT2_MS; return at <= now ? { n, ready: true } : { n, wait: at - now }; }
  const w = S.wrong[key] || 0; return w >= 2 ? { n, ready: true } : { n, needWrong: 2 - w };
}
const LIVE = new Set();
function liveTick() { LIVE.forEach(f => { if (!f._el.isConnected) LIVE.delete(f); else f(); }); applyCool(); }
setInterval(liveTick, 1000);
function hintBox(key, hints) {
  const wrap = h('div', { class: 'hints' });
  const list = h('ol', { class: 'hint-list' });
  const btn = h('button', { class: 'btn hint-btn', type: 'button' });
  const note = h('p', { class: 'hint-rule' }, 'רמז 1 נפתח 45 שניות אחרי שנכנסים לחדר, רמז 2 – 30 שניות אחרי שפתחתם את רמז 1, ורמז 3 – רק אחרי 2 ניסיונות שגויים במנעול. <b>כל רמז מוסיף דקה לזמן הקבוצה.</b>');
  let shown = -1;
  const draw = () => {
    if (TEACHER) { if (shown !== 99) { list.innerHTML = hints.map(x => `<li>${x}</li>`).join(''); shown = 99; } btn.hidden = true; note.textContent = '👩‍🏫 מצב מורה: כל הרמזים גלויים, בלי המתנה ובלי תוספת זמן.'; return; }
    const st = hintInfo(key, hints);
    if (st.n !== shown) { list.innerHTML = hints.slice(0, st.n).map(x => `<li>${x}</li>`).join(''); shown = st.n; }
    btn.hidden = false; btn.classList.toggle('ready', !!st.ready); btn.classList.toggle('locked', !st.ready && !st.done);
    if (st.done) { btn.textContent = '💡 פתחתם את כל הרמזים'; btn.disabled = true; }
    else if (st.ready) { btn.textContent = `💡 לפתוח רמז ${st.n + 1} מתוך ${hints.length} (+1 דקה)`; btn.disabled = false; }
    else if (st.wait) { btn.innerHTML = `🔒 רמז ${st.n + 1} ייפתח בעוד <b class="hcd">${fmt(Math.ceil(st.wait / 1000) * 1000)}</b>`; btn.disabled = true; }
    else { btn.textContent = `🔒 רמז 3 ייפתח אחרי 2 ניסיונות שגויים במנעול${st.needWrong === 1 ? ' (נשאר עוד אחד)' : ''}`; btn.disabled = true; }
  };
  btn.addEventListener('click', () => { const st = hintInfo(key, hints); if (!st.ready || TEACHER) return; S.hints[key] = st.n + 1; S.hintT[key] = [...(S.hintT[key] || []), Date.now()]; save(); SND.sfx('click'); toast('💡 רמז נפתח · +1 דקה לזמן הקבוצה'); tickTimer(); liveTick(); });
  draw._el = wrap; LIVE.add(draw); draw(); wrap.append(btn, list, note); return wrap;
}
/* ---------- נעילת 15 שניות אחרי תשובה שגויה ---------- */
const coolLeft = key => TEACHER ? 0 : Math.max(0, (S.cool[key] || 0) - Date.now());
function lockWrong(key, el, msg) {
  wrongFx(el, msg);
  if (TEACHER) return;
  S.wrong[key] = (S.wrong[key] || 0) + 1; S.cool[key] = Date.now() + COOL_MS; save();
  liveTick();
}
function applyCool() {
  const w = $('#mbody .lock');
  if (w && w.dataset.key) {
    const left = coolLeft(w.dataset.key), body = w.querySelector('.lbody'); let ov = body && body.querySelector('.cool');
    if (left > 0 && body) { if (!ov) { ov = h('div', { class: 'cool', role: 'status' }); body.appendChild(ov); } ov.innerHTML = `<div><span class="cl-ic">🔒</span><b>המנעול ננעל אחרי תשובה שגויה</b><span class="cl-t">${fmt(Math.ceil(left / 1000) * 1000)}</span><small>אפשר לנסות שוב כשהשעון יגיע ל-00:00. בינתיים חשבו ביחד או הסתכלו שוב ברמזים.</small></div>`; w.classList.add('cooling'); }
    else if (ov) { ov.remove(); w.classList.remove('cooling'); const f = w.querySelector('.feedback'); if (f && f.classList.contains('bad')) { f.className = 'feedback'; f.textContent = 'המנעול פתוח שוב – נסו עכשיו 🙂'; } }
  }
  const lb = $('#panel .lockbtn'); if (lb && lb.dataset.key) { const left = coolLeft(lb.dataset.key); const base = lb.dataset.base; lb.textContent = left > 0 ? `🔒 ${base} – נעול עוד ${fmt(Math.ceil(left / 1000) * 1000)}` : lb.dataset.label; }
}
const totalHints = () => Object.values(S.hints).reduce((a, b) => a + b, 0);

/* ======================= סצנות מצוירות (תלת ממד מרונדר) ======================= */
let curView = 'hub', cur = null, spotEls = [], panX = 0, panY = 0, lay = null;
const MEDIA = {"img/sc-hub.webp": "", "img/sc-class.webp": "", "img/sc-bedroom.webp": "", "img/sc-mall.webp": "", "og.jpg": "", "img/sc-family.webp": "", "img/sc-airport.webp": "", "img/sc-library.webp": "", "img/sc-finale.webp": "", "img/trio.webp": "", "clip/finale.mp4": "", "clip/finale.jpg": ""};
const M = p => (MEDIA[p] || '') + p;
const SCN_Z = { hub: 1 };
const SCN = {"hub": {"img": "hub", "spots": [{"id": "go:class", "x": 12, "y": 34, "r": [0, 24, 24, 26]}, {"id": "go:bedroom", "x": 32, "y": 24, "r": [25, 4, 15, 40]}, {"id": "go:mall", "x": 53, "y": 27, "r": [41, 12, 28, 28]}, {"id": "go:family", "x": 79, "y": 45, "r": [69, 33, 24, 24]}, {"id": "go:airport", "x": 86, "y": 17, "r": [72, 2, 27, 28]}, {"id": "go:office", "x": 58, "y": 73, "r": [43, 56, 30, 30]}]}, "class": {"img": "class", "spots": [{"id": "board", "x": 52, "y": 23}, {"id": "envelope", "x": 58, "y": 45}, {"id": "book", "x": 49, "y": 43}, {"id": "x1", "x": 23, "y": 14, "decoy": "גלובוס ישן. לעולם הגדול נגיע בחדר האחרון ✈️"}, {"id": "x2", "x": 43, "y": 79, "decoy": "תיק של מישהו מהכיתה. רק מחברות ריקות ותפוח 🍎"}, {"id": "lock", "x": 52, "y": 57}]}, "bedroom": {"img": "bedroom", "spots": [{"id": "diary", "x": 93, "y": 61}, {"id": "cork", "x": 63, "y": 31}, {"id": "masks", "x": 63, "y": 9}, {"id": "ring", "x": 53, "y": 23}, {"id": "x1", "x": 13, "y": 75, "decoy": "הטלפון של נועם: 37 הודעות שלא נקראו בקבוצה של השכבה 📱 לא רמז."}, {"id": "x2", "x": 60, "y": 69, "decoy": "נעלי ספורט צבעוניות. נשמור אותן לקניון 👟"}, {"id": "lock", "x": 26, "y": 46}]}, "mall": {"img": "mall", "spots": [{"id": "table", "x": 28, "y": 80}, {"id": "gate", "x": 88, "y": 58}, {"id": "billboard", "x": 44, "y": 22}, {"id": "shoes", "x": 13, "y": 55}, {"id": "x1", "x": 70, "y": 56, "decoy": "דוכן כיסויים לטלפון. המוכר מציע הנחה… לא רמז 🙂"}, {"id": "x2", "x": 82, "y": 84, "decoy": "שקיות קניות שמישהו השאיר על הספסל. ריקות."}, {"id": "lock", "x": 56, "y": 63}]}, "family": {"img": "family", "spots": [{"id": "album", "x": 60, "y": 77}, {"id": "wedding", "x": 40, "y": 12}, {"id": "photo", "x": 57, "y": 22}, {"id": "tablet", "x": 16, "y": 62}, {"id": "x1", "x": 92, "y": 38, "decoy": "שולחן ערב שבת: נרות וחלה. מסורת שעוברת בין הדורות 🕯️ – אבל אין כאן רמז."}, {"id": "x2", "x": 67, "y": 52, "decoy": "הכורסה של סבא. השמיכה הסרוגה עוד חמימה."}, {"id": "lock", "x": 41, "y": 50}]}, "airport": {"img": "airport", "spots": [{"id": "globe", "x": 57, "y": 30}, {"id": "burger", "x": 15, "y": 43}, {"id": "passport", "x": 18, "y": 83}, {"id": "booths", "x": 80, "y": 34}, {"id": "board", "x": 35, "y": 10}, {"id": "x1", "x": 86, "y": 76, "decoy": "מזוודות מלאות מדבקות מכל העולם. מישהו טייל הרבה 🧳"}, {"id": "x2", "x": 30, "y": 41, "decoy": "דלפק המודיעין סגור: \"נחזור בעוד 5 דקות\"."}, {"id": "lock", "x": 66, "y": 62}]}, "office": {"img": "library", "spots": [{"id": "notebook", "x": 24, "y": 72}, {"id": "glasses", "x": 36, "y": 70}, {"id": "chair", "x": 30, "y": 45}, {"id": "x1", "x": 7, "y": 42, "decoy": "מנורת קריאה ירוקה. רק אבק כאן…"}, {"id": "x2", "x": 92, "y": 60, "decoy": "עגלת ספרים להחזרה. \"מבוא לסוציולוגיה\" – שלושה עותקים 📚"}, {"id": "lock", "x": 64, "y": 48}]}};
const IMG_W = 1920, IMG_H = 1088;
const ICON = { clue: '?', found: '✓', lock: '🔒', locked: '🔒', open: '', solved: '✓', office: '🔐' };
function init3d() {
  const v = $('#view3d');
  new ResizeObserver(layout).observe(v);
  let down = null;
  v.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, px: panX, py: panY, moved: false }; });
  window.addEventListener('pointermove', e => {
    if (down) { const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.hypot(dx, dy) > 8) down.moved = true; if (down.moved && lay && (lay.ox || lay.oy)) { panX = down.px + dx; panY = down.py + dy; applyPan(); } }
    else if (e.pointerType === 'mouse' && lay && v.contains(e.target)) { const r = v.getBoundingClientRect(); const nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5; $('#scnPar').style.transform = `translate(${-nx * 14}px,${-ny * 10}px)`; glintNear(e.clientX, e.clientY); }
  });
  window.addEventListener('pointerup', () => { if (down && down.moved) { v.dataset.dragged = '1'; setTimeout(() => { delete v.dataset.dragged; }, 50); } down = null; });
  v.addEventListener('pointerleave', () => { $('#scnPar').style.transform = ''; glintNear(-1e4, -1e4); });
}
// נצנוץ שמתחזק ככל שהעכבר מתקרב לחפץ (במחשב)
function glintNear(x, y) { $$('#spots .hs').forEach(el => { const b = el.getBoundingClientRect(); const d = Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2)); const R = Math.max(110, b.width * 1.6); el.style.setProperty('--g', d < R ? (1 - d / R).toFixed(2) : 0); }); }
function layout() {
  const v = $('#view3d'); const w = v.clientWidth, hh = v.clientHeight; if (!w || !hh) return;
  const s0 = Math.min(w / IMG_W, hh / IMG_H), s1 = Math.max(w / IMG_W, hh / IMG_H), s = Math.min(s1, s0 * (SCN_Z[curView] || 1.1));
  const bw = IMG_W * s, bh = IMG_H * s; const box = $('#scnBox'); box.style.width = bw + 'px'; box.style.height = bh + 'px';
  lay = { w, h: hh, bw, bh, ox: Math.max(0, bw - w), oy: Math.max(0, bh - hh) };
  panX = (w - bw) / 2; panY = (hh - bh) / 2;
  applyPan();
  const dh = $('.drag-hint'); dh.style.animation = 'none'; void dh.offsetWidth; dh.style.animation = '';
  const touch = matchMedia('(hover:none)').matches;
  dh.textContent = curView === 'hub' ? ((lay.ox > 4 || lay.oy > 4) ? 'לחצו על מקום · גררו להזזה' : 'לחצו על המקום הזוהר') : ((lay.ox > 4 || lay.oy > 4) ? 'גררו כדי להסתכל מסביב · חפשו חפצים שמנצנצים' : (touch ? 'חפשו חפצים שמנצנצים מדי פעם' : 'הזיזו את העכבר על החפצים – משהו ינצנץ'));
}
function applyPan() {
  if (!lay) return;
  panX = lay.bw > lay.w ? Math.min(0, Math.max(lay.w - lay.bw, panX)) : (lay.w - lay.bw) / 2;
  panY = lay.bh > lay.h ? Math.min(0, Math.max(lay.h - lay.bh, panY)) : (lay.h - lay.bh) / 2;
  $('#scnPan').style.transform = `translate(${panX}px,${panY}px)`;
  // סימנים שיוצאים מגבולות התצוגה נצמדים לשוליים כדי שתמיד יהיה אפשר ללחוץ עליהם
  spotEls.forEach(el => { const x = el._x / 100 * lay.bw + panX, y = el._y / 100 * lay.bh + panY; const cx = Math.min(lay.w - 26, Math.max(26, x)), cy = Math.min(lay.h - 30, Math.max(30, y)); el.style.setProperty('--dx', (cx - x) + 'px'); el.style.setProperty('--dy', (cy - y) + 'px'); });
}
function showScene(view) {
  const tp = $('#tip'); if (tp) tp.hidden = true;
  curView = view; cur = SCN[view];
  const img = $('#scnImg'), bg = $('#scnBg'), src = M(`img/sc-${cur.img}.webp`) + '?v=2';
  img.src = src; bg.style.backgroundImage = `url("${src}")`; img.alt = view === 'hub' ? 'מפת העיר: בית הספר, בניין המגורים, הקניון, בית המשפחה, שדה התעופה והספרייה' : (spot(view).name || '');
  const kb = $('#scnKb'); kb.classList.remove('enter'); void kb.offsetWidth; kb.classList.add('enter');
  const box = $('#spots'); box.innerHTML = ''; spotEls = [];
  cur.spots.forEach((m, i) => {
    if (m.r) { const ar = h('button', { class: 'area', type: 'button', 'data-id': m.id, 'aria-hidden': 'true', tabindex: '-1', style: `left:${m.r[0]}%;top:${m.r[1]}%;width:${m.r[2]}%;height:${m.r[3]}%` }); ar.addEventListener('click', ev => clickSpot(ev, m.id)); ar.addEventListener('mouseenter', () => box.querySelector(`.spot[data-id="${m.id}"]`)?.classList.add('hov')); ar.addEventListener('mouseleave', () => box.querySelector(`.spot[data-id="${m.id}"]`)?.classList.remove('hov')); box.appendChild(ar); }
    if (view !== 'hub' && m.id !== 'lock' && !isGateSpot(view, m.id)) { // חפץ נסתר: נצנוץ עדין בלבד, בלי סימן
      const hs = h('button', { class: 'hs', type: 'button', 'data-id': m.id, 'aria-label': 'חפץ בחדר', style: `left:${m.x}%;top:${m.y}%;--i:${(i * 7) % 5}` }, '<span class="glint"></span><span class="ok">✓</span>');
      hs.addEventListener('click', ev => clickSpot(ev, m.id)); box.appendChild(hs); return;
    }
    const el = h('button', { class: 'spot', type: 'button', 'data-id': m.id, style: `left:${m.x}%;top:${m.y}%;--i:${i}` }, '<span class="dot"><span class="ic"></span></span><span class="lab"></span>');
    el._x = m.x; el._y = m.y; el.addEventListener('click', ev => clickSpot(ev, m.id)); box.appendChild(el); spotEls.push(el);
  });
  refreshMarkers(); layout();
}
function clickSpot(ev, id) { ev.stopPropagation(); if ($('#view3d').dataset.dragged) return; SND.sfx('click'); onPick(id); }
function refreshMarkers() {
  const box = $('#spots'); if (!box) return;
  box.querySelectorAll('.hs').forEach(el => { const id = el.dataset.id; const c = !/^x\d/.test(id) && found(curView, id); el.classList.toggle('found', !!c); el.title = c ? ((spot(curView).clues.find(x => x.id === id) || {}).title || '') : ''; });
  box.querySelectorAll('.spot, .area').forEach(el => {
    const id = el.dataset.id; let k = 'clue', lab = '';
    if (curView === 'hub') { const rid = id.slice(3); if (rid === 'office') { k = isOpen('office') ? 'office' : 'locked'; lab = OFFICE.name; } else { const r = roomById(rid); k = isSolved(rid) ? 'solved' : isOpen(rid) ? 'open' : 'locked'; lab = `${r.n}. ${r.name}`; } }
    else if (id === 'lock') { k = isSolved(curView) ? 'solved' : (allFound(curView) || TEACHER) ? 'lock' : 'locked'; if (curView === 'office' && !ROOMS.every(r => isSolved(r.id)) && !TEACHER) k = 'locked'; lab = spot(curView).lock.title; }
    else if (isGateSpot(curView, id)) { k = found(curView, id) ? 'solved' : (cluesDone(curView) || TEACHER) ? 'lock' : 'locked'; lab = (spot(curView).clues.find(c => c.id === id) || {}).title; }
    else { k = found(curView, id) ? 'found' : 'clue'; lab = found(curView, id) ? (spot(curView).clues.find(c => c.id === id) || {}).title : 'מה יש כאן?'; }
    el.className = (el.classList.contains('area') ? 'area ' : 'spot ') + k;
    if (el.classList.contains('spot')) { const n = curView === 'hub' && id !== 'go:office' ? String(roomById(id.slice(3)).n) : ''; el.querySelector('.ic').textContent = k === 'open' ? n : (k === 'office' ? '🔐' : ICON[k]); el.querySelector('.lab').textContent = lab; el.setAttribute('aria-label', lab + (k === 'locked' ? ' (נעול)' : '')); if (isGateSpot(curView, id) && k === 'lock') el.querySelector('.ic').textContent = '🛫'; }
  });
  if (curView === 'hub') { const nx = [...ROOMS, { id: 'office' }].find(r => isOpen(r.id) && !isSolved(r.id)); box.querySelectorAll('.next').forEach(e => e.classList.remove('next')); if (nx) box.querySelectorAll(`[data-id="go:${nx.id}"]`).forEach(e => e.classList.add('next')); }
}
function tipText(id) {
  if (id.startsWith('go:')) { const rid = id.slice(3); const nm = rid === 'office' ? OFFICE.name : roomById(rid).name; return nm + (isOpen(rid) ? '' : ' 🔒'); }
  if (id === 'lock') return spot(curView).lock.title;
  const c = spot(curView).clues.find(c => c.id === id); return c ? (found(curView, id) ? c.title : 'מה יש כאן?') : '';
}
function onPick(id) {
  if (id.startsWith('go:')) return go(id.slice(3));
  const dm = cur && cur.spots.find(s => s.id === id); if (dm && dm.decoy) { toast('🔎 ' + dm.decoy, 2400); return; }
  if (id === 'lock') return openLock(curView);
  openClue(curView, id);
}

/* ======================= קליפים ======================= */
const CLIPS = { finale: 'clip/finale.mp4' };
const IMGCLIP = { intro: 'img/sc-hub.webp', finale: 'img/sc-finale.webp' };
let clipDone = null;
function playClip(name, caps, done, minDur = 0) {
  const ov = $('#clip'), vd = $('#clipVid'), im = $('#clipImg'), cp = $('#clipCap'), pb = $('#clipPlay');
  closeModal(); clipDone = done || null; ov.hidden = false; ov.classList.remove('out'); cp.innerHTML = ''; pb.hidden = true;
  const tok = ov._tok = (ov._tok || 0) + 1;
  let last = -1, t0 = 0, ended = false; const total = Math.max(minDur, caps.length ? caps[caps.length - 1][0] + 2.4 : 0);
  const tick = () => {
    if (ov.hidden || clipDone === undefined) return;
    const t = t0 ? (performance.now() - t0) / 1000 : 0; let idx = -1; caps.forEach((c, i) => { if (t >= c[0]) idx = i; });
    if (idx !== last) { last = idx; cp.innerHTML = idx >= 0 ? `<span>${caps[idx][1]}</span>` : ''; }
    if (ended && t >= total) return endClip();
    ov._raf = requestAnimationFrame(tick);
  };
  cancelAnimationFrame(ov._raf);
  if (!CLIPS[name]) { // "קליפ" מתמונה מצוירת: תנועת מצלמה איטית
    vd.hidden = true; im.hidden = false; im.className = 'kb-' + name; im.src = M(IMGCLIP[name]) + '?v=2'; void im.offsetWidth; im.classList.add('go');
    t0 = performance.now(); ended = true; ov._raf = requestAnimationFrame(tick); return;
  }
  im.hidden = true; vd.hidden = false;
  vd.muted = true; vd.defaultMuted = true; vd.playsInline = true; vd.setAttribute('playsinline', ''); vd.setAttribute('muted', '');
  vd.poster = M(CLIPS[name].replace('.mp4', '.jpg')) + '?v=2'; vd.removeAttribute('src');
  vd.onplaying = () => { if (!t0) t0 = performance.now(); };
  vd.onended = () => { ended = true; };
  vd.onerror = () => { ended = true; if (!t0) t0 = performance.now(); };
  ov._raf = requestAnimationFrame(tick);
  clipURL(name).then(u => { if (ov._tok !== tok || ov.hidden) return; vd.src = u; const pr = vd.play(); if (pr && pr.catch) pr.catch(() => { if (ov._tok === tok && !ov.hidden) pb.hidden = false; }); });
}
const BLOBS = {};
function clipURL(name) {
  if (BLOBS[name]) return BLOBS[name];
  const url = M(CLIPS[name]) + '?v=2';
  if (/^https?:/.test(url) && !url.startsWith(location.origin)) return (BLOBS[name] = Promise.resolve(url));
  return (BLOBS[name] = fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(b => URL.createObjectURL(b)).catch(() => { delete BLOBS[name]; return url; }));
}
function endClip() {
  const ov = $('#clip'), vd = $('#clipVid'); if (ov.hidden) return;
  cancelAnimationFrame(ov._raf); vd.onended = vd.onplaying = vd.onerror = null; try { vd.pause(); } catch (e) { }
  ov.classList.add('out'); setTimeout(() => { ov.hidden = true; vd.removeAttribute('src'); vd.load(); }, 350);
  const f = clipDone; clipDone = null; if (f) f();
}
function wireClip() {
  $('#clipSkip').addEventListener('click', () => { SND.sfx('click'); endClip(); });
  $('#clipPlay').addEventListener('click', () => { $('#clipPlay').hidden = true; $('#clipVid').play().catch(() => { $('#clipVid').onerror(); }); });
}

/* ======================= ניווט ופאנל ======================= */
function go(id) {
  if (!isOpen(id)) { SND.sfx('wrong'); const prev = id === 'office' ? 'כל חמשת המקומות' : roomById(ROOMS[roomById(id).n - 2].id).name; toast(`🔒 המקום עוד נעול. קודם פתרו את: ${prev}`); return; }
  if (!S.enter[id] && !isSolved(id)) { S.enter[id] = Date.now(); save(); }
  showScene(id); renderPanel(); $('#panel').scrollTop = 0;
  S.seen = S.seen || [];
  if (!S.seen.includes(id)) { S.seen.push(id); save(); const nm = id === 'office' ? OFFICE.name : roomById(id).name; toast(`📰 שי ואלמה הגיעו אל ${nm}. חפשו חפצים שמנצנצים…`, 3200); }
}
function goHub() { showScene('hub'); renderPanel(); }
function say(who, text) { return `<div class="say"><div class="ava">${avaImg(who)}</div><div class="bubble"><b class="who">${AVA[who]}:</b> ${text}</div></div>`; }
function renderPanel() {
  const p = $('#panel'); if (!p) return; p.innerHTML = '';
  if (curView === 'hub') {
    const n = S.solved.length;
    p.appendChild(h('div', { class: 'ptitle' }, `<span class="pico">🗺️</span><div><h2>מפת העיר · בעקבות המורה נוגה</h2><div class="psub">קבוצת ${esc(S.group || 'הסוציולוגים')} · ${n} מתוך 5 מקומות</div></div>`));
    p.insertAdjacentHTML('beforeend', n === 0 ? say('alma', 'נוגה השאירה עקבות בחמישה מקומות בעיר, והם נפתחים אחד אחרי השני. מתחילים ב<b>כיתה הריקה</b> – לחצו עליה בציור או ברשימה.') : n < 5 ? say('shai', `יפה מאוד! פתרתם ${n} ${n === 1 ? 'מקום' : 'מקומות'}. המקום הבא כבר פתוח – ממשיכים!`) : say('shai', 'אספתם את כל חמש הספרות! עכשיו לכו ל<b>ספרייה</b> ופתחו את הכספת.'));
    const list = h('div', { class: 'places' });
    [...ROOMS, { id: 'office', n: 6, name: OFFICE.name, icon: OFFICE.icon, color: '#4361ee' }].forEach(r => {
      const st = isSolved(r.id) ? 'solved' : isOpen(r.id) ? 'open' : 'locked';
      const lab = st === 'solved' ? `✓ ${r.word}` : st === 'open' ? 'פתוח – כנסו!' : '🔒 נעול';
      list.appendChild(h('button', { class: 'place ' + st, style: `--c:${r.color}`, onclick: () => { SND.sfx('click'); go(r.id); } }, `<span class="pnum">${r.n < 6 ? r.n : '★'}</span><span class="picon">${r.icon}</span><span class="pname">${r.name}</span><span class="pstate">${lab}</span>`));
    });
    p.appendChild(list);
    p.insertAdjacentHTML('beforeend', '<p class="tip">💡 לחצו על המקום הזוהר בציור או ברשימה. מקום נעול מופיע אפור עם מנעול.</p>');
    return;
  }
  const sp = spot(curView), isOff = curView === 'office';
  p.appendChild(h('button', { class: 'btn back', onclick: () => { SND.sfx('click'); goHub(); } }, '→ חזרה למפה'));
  p.appendChild(h('div', { class: 'ptitle', style: `--c:${sp.color || '#4361ee'}` }, `<span class="pico">${sp.icon}</span><div><h2>${isOff ? '' : sp.n + '. '}${sp.name}</h2>${isOff ? '<div class="psub">הכספת הסופית</div>' : `<div class="psub">מקום ${sp.n} מתוך 5</div>`}</div>`));
  const who = /^שי:/.test(sp.intro) ? 'shai' : 'alma';
  p.insertAdjacentHTML('beforeend', say(who, sp.intro.replace(/^[^:]+: "?/, '').replace(/"$/, '')));
  const nfd = cl4(curView).filter(c => found(curView, c.id)).length;
  p.appendChild(h('h3', { class: 'clue-h' }, `🔎 רמזים שמצאתם: ${nfd} מתוך ${cl4(curView).length}`));
  const cl = h('div', { class: 'clues' });
  cl4(curView).forEach(c => { const f = found(curView, c.id); cl.appendChild(h('button', { class: 'clue ' + (f ? 'found' : ''), onclick: () => { if (f) openClue(curView, c.id); else { toast(matchMedia('(hover:none)').matches ? 'חפשו בתמונה חפץ שמנצנץ מדי פעם 👀' : 'הזיזו את העכבר על החפצים בתמונה – רמז מנצנץ כשמתקרבים 👀'); } } }, f ? `✓ ${c.title}` : '❓ רמז שעוד לא נמצא')); });
  p.appendChild(cl);
  const gc = sp.clues.find(c => c.gate);
  if (gc) { const gs = found(curView, gc.id), go2 = TEACHER || cluesDone(curView); p.appendChild(h('button', { class: 'btn wide gatebtn' + (gs ? ' done' : go2 ? '' : ' dim'), onclick: () => { SND.sfx('click'); openClue(curView, gc.id); } }, gs ? `✓ ${gc.title} – פתרתם!` : go2 ? `🛫 ${gc.title} נדלק – לחצו לפתרון` : `🔒 ${gc.title} (נפתח אחרי שתמצאו ותקראו את כל ${cl4(curView).length} הרמזים)`)); }
  const solved = isSolved(curView);
  const ready = TEACHER || (allFound(curView) && (!isOff || ROOMS.every(r => isSolved(r.id))));
  if (solved && !isOff) { p.insertAdjacentHTML('beforeend', `<div class="solved-box">✓ המקום נפתר! המילה: <b>${sp.word}</b> · הספרה: <b>${sp.digit}</b><small>${sp.topic}</small></div>`); p.appendChild(h('button', { class: 'btn primary wide', onclick: goHub }, '🗺️ חזרה למפה – למקום הבא')); }
  else { const lab = `🔐 ${sp.lock.title}` + (ready ? '' : (gc && cluesDone(curView)) ? ` (פתרו קודם את ${gc.title})` : ' (מצאו קודם את כל הרמזים)'); const lb = h('button', { class: 'btn primary wide lockbtn' + (ready ? '' : ' dim'), onclick: () => openLock(curView), 'data-key': curView, 'data-base': sp.lock.title, 'data-label': lab }, lab); p.appendChild(lb);
    const hb = hintBox(curView, sp.lock.hints); hb.classList.add('phints'); hb.insertBefore(h('h3', { class: 'clue-h' }, '💡 רמזים לפתרון המנעול'), hb.firstChild); p.appendChild(hb); applyCool(); }
  if (isOff && S.finishMs) p.appendChild(h('button', { class: 'btn wide', onclick: showEnding }, '📰 לעיתון הסיום'));
  p.insertAdjacentHTML('beforeend', '<p class="tip">🔎 הרמזים לא מסומנים: חפשו בסצנה חפצים שמנצנצים (במחשב – כשהעכבר מתקרב, בטלפון – נצנוץ עדין מדי כמה שניות). לא כל חפץ הוא רמז! כל רמז נותן רק חלק מהמידע – חברו ביניהם. תשובה שגויה נועלת את המנעול ל-15 שניות.</p>');
}
/* ======================= רמזים (קלפים) ======================= */
function openClue(rid, cid) {
  const sp = spot(rid), c = sp.clues.find(x => x.id === cid); if (!c) return;
  if (c.gate && !TEACHER && !cluesDone(rid)) { SND.sfx('wrong'); const left = cl4(rid).filter(x => !found(rid, x.id)).length; toast(`🔒 ${c.title} עוד כבוי. מצאו וקראו קודם את כל ${cl4(rid).length} הרמזים (נשארו ${left})`, 3200); return; }
  if (c.widget === 'cipher') return cipherWidget(rid, c);
  if (c.widget === 'key') { openModal({ title: '✉️ ' + c.title, html: '<p>במעטפה כרטיס עם טבלה: לכל אות – אימוג\'י. בעזרתה אפשר לפענח את ההודעה שעל הלוח.</p>' + keyTable() + '<p class="credit">כתב הסתרים מהחדר המקורי של עינבל אריאלי</p>', wide: true, buttons: [{ t: 'הבנתי 👍', primary: true }] }); markFound(rid, cid); return; }
  if (c.widget === 'xword') return xwordWidget(rid, c);
  if (c.widget === 'memory') return memoryWidget(rid, c);
  openModal({ title: c.title, html: c.html, buttons: [{ t: 'הבנתי 👍', primary: true }] });
  markFound(rid, cid);
}
function keyTable() { return `<div class="ckey">${Object.entries(CIPHER).map(([l, e]) => `<div><b>${l}</b><span>${e}</span></div>`).join('')}</div>`; }
function cipherWidget(rid, c) {
  const words = CIPHER_MSG.split(' ');
  const wrap = h('div', { class: 'cipher' });
  const haveKey = found(rid, 'envelope') || TEACHER;
  wrap.innerHTML = `<p>על הלוח, בגיר, נוגה כתבה הודעה בכתב סתרים. כל אימוג'י הוא אות אחת. קוראים מימין לשמאל.</p>
  <div class="cmsg">${words.map(w => `<span class="cw">${[...w].map(ch => `<span class="cl"><span class="ce">${CIPHER[ch]}</span><input maxlength="1" aria-label="אות" data-a="${ch}"></span>`).join('')}</span>`).join('')}</div>
  ${haveKey ? '<details class="kd"><summary>🔑 מפתח הצופן (מהמעטפה)</summary>' + keyTable() + '</details>' : '<p class="note">🔑 בלי מפתח קשה לפענח… אולי הוא מסתתר איפשהו בכיתה?</p>'}
  <p class="center small">אפשר להקליד את האותיות מתחת לאימוג'ים – אות נכונה נצבעת בירוק.</p><div class="feedback"></div><p class="credit">כתב הסתרים מהחדר המקורי של עינבל אריאלי</p>`;
  const ins = $$('input', wrap);
  const chk = () => { let all = true; ins.forEach(i => { const ok = i.value && nl(i.value) === nl(i.dataset.a); i.classList.toggle('ok', !!ok); if (!ok) all = false; }); if (all) { okFx('פענחתם! "סוציוס" = חברה, "לוגוס" = תורה 🎉'); } };
  ins.forEach((i, k) => i.addEventListener('input', () => { chk(); if (i.value && ins[k + 1]) ins[k + 1].focus(); }));
  openModal({ title: '🧑‍🏫 ' + c.title, node: wrap, wide: true, buttons: [{ t: 'סגירה' }] });
  markFound(rid, c.id);
}
function xwordWidget(rid, c) {
  const X = XWORD, wrap = h('div', { class: 'xw' });
  const cells = {}; const nums = {}; let n = 0;
  const starts = X.words.map(w => [w.r, w.c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  starts.forEach(([r, cc]) => { const k = r + ',' + cc; if (!nums[k]) nums[k] = ++n; });
  X.words.forEach(w => { [...w.w].forEach((ch, i) => { const r = w.r + (w.dir === 'd' ? i : 0), cc = w.c + (w.dir === 'a' ? i : 0); cells[r + ',' + cc] = ch; }); w.num = nums[w.r + ',' + w.c]; });
  const mark = new Set(X.marks.map(m => m.join(',')));
  let grid = '';
  for (let r = 0; r < X.rows; r++) for (let cc = 0; cc < X.cols; cc++) { const k = r + ',' + cc; grid += cells[k] ? `<span class="xc${mark.has(k) ? ' mk' : ''}" style="grid-row:${r + 1};grid-column:${cc + 1}">${nums[k] ? `<i>${nums[k]}</i>` : ''}<input maxlength="1" data-a="${cells[k]}" data-k="${k}" aria-label="משבצת" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="next"></span>` : ''; }
  const clue = d => X.words.filter(w => w.dir === d).sort((a, b) => a.num - b.num).map(w => `<li data-d="${w.dir}" data-n="${w.num}"><b>${w.num}.</b> ${w.clue} <small>(${w.w.length})</small></li>`).join('');
  wrap.innerHTML = `<p>באלבום, בין התמונות, נוגה הדביקה תשבץ. פתרו אותו – והאותיות במשבצות <span class="mkx">הצבועות</span> יוצרות מילה (לא לפי הסדר).</p>
  <div class="xwrap"><div class="xgrid" style="grid-template-columns:repeat(${X.cols},var(--xs));grid-template-rows:repeat(${X.rows},var(--xs))">${grid}</div>
  <div class="xclues"><h4>מאוזן ←</h4><ol>${clue('a')}</ol><h4>מאונך ↓</h4><ol>${clue('d')}</ol></div></div><div class="feedback"></div><p class="credit">התשבץ מהחדר המקורי של עינבל אריאלי</p>`;
  const ins = $$('input', wrap);
  S.xw = S.xw || {};
  const at = (r, cc) => wrap.querySelector(`input[data-k="${r},${cc}"]`);
  const inWord = (inp, d) => X.words.some(w => w.dir === d && [...w.w].some((_, i) => (w.r + (d === 'd' ? i : 0)) + ',' + (w.c + (d === 'a' ? i : 0)) === inp.dataset.k));
  const wordFull = (inp, d) => { const w = X.words.find(w => w.dir === d && w.r + ',' + w.c === inp.dataset.k); return !!w && [...w.w].every((_, k) => { const e = at(w.r + (d === 'd' ? k : 0), w.c + (d === 'a' ? k : 0)); return e && e.value; }); };
  const isStart = (inp, d) => X.words.some(w => w.dir === d && w.r + ',' + w.c === inp.dataset.k);
  let dir = 'a', last = null;
  const step = (inp, k) => { const [r, cc] = inp.dataset.k.split(',').map(Number); return dir === 'a' ? at(r, cc + k) : at(r + k, cc); };
  const go = el => { if (el) { el.focus(); try { el.select(); } catch (e) { } } };
  const chk = (quiet) => { let all = true; ins.forEach(i => { const ok = i.value && nl(i.value) === nl(i.dataset.a); i.classList.toggle('ok', !!ok); if (!ok) all = false; });
    if (all) { okFx('פתרתם את התשבץ! עכשיו חברו את האותיות הצבועות למילה אחת 🧩'); if (!quiet) markFound(rid, c.id); } };
  ins.forEach(i => {
    i.value = S.xw[i.dataset.k] || '';
    i.addEventListener('focus', () => { if (last !== i) { const sa = isStart(i, 'a'), sd = isStart(i, 'd'); if (sd && !sa) dir = 'd'; else if (sa && !sd) dir = 'a'; else if (sa && sd) { if (wordFull(i, dir)) dir = dir === 'a' ? 'd' : 'a'; } else if (!inWord(i, dir)) dir = dir === 'a' ? 'd' : 'a'; } last = i; try { i.select(); } catch (e) { } });
    i.addEventListener('click', () => { if (document.activeElement === i && i.dataset.tapped && inWord(i, dir === 'a' ? 'd' : 'a')) dir = dir === 'a' ? 'd' : 'a'; i.dataset.tapped = '1'; });
    i.addEventListener('blur', () => { delete i.dataset.tapped; });
    i.addEventListener('input', e => {
      let v = i.value.replace(/\s/g, ''); v = v ? v.slice(-1) : ''; i.value = v;
      S.xw[i.dataset.k] = v; save(); chk();
      if (v) { const nx = step(i, 1); if (nx) go(nx); }
    });
    i.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !i.value) { e.preventDefault(); const pv = step(i, -1); if (pv) { pv.value = ''; S.xw[pv.dataset.k] = ''; save(); chk(); go(pv); } }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); dir = 'a'; go(step(i, e.key === 'ArrowLeft' ? 1 : -1)); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); dir = 'd'; go(step(i, e.key === 'ArrowDown' ? 1 : -1)); }
      else if (e.key === 'Enter') { e.preventDefault(); go(step(i, 1)); }
    });
  });
  $$('.xclues li', wrap).forEach(li => { const w = X.words.find(w => w.dir === li.dataset.d && String(w.num) === li.dataset.n); if (!w) return; li.style.cursor = 'pointer'; li.addEventListener('click', () => { const e = at(w.r, w.c); last = e; dir = w.dir; go(e); }); });
  chk(true);
  openModal({ title: '📖 ' + c.title, node: wrap, wide: true, buttons: [{ t: 'סגירה' }] });
  markFound(rid, c.id);
}



function memoryWidget(rid, c) {
  const wrap = h('div', { class: 'memo' }); const PK = PEEK_MS * 1.7;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const piece = '<p class="piece">🧩 כל הזוגות בלוח הם חלק מתהליך אחד גדול שבו העולם כולו נעשה מחובר. איך קוראים לו? (בלועזית "עולמי" = גלובלי…)</p>';
  let deck = [], first = null, busy = false, pairs = 0, tries = 0, peekT = 0;
  const intro = () => {
    wrap.innerHTML = `<p class="big">לוח ההמראות 🛫</p><p>על הלוח 12 שלטים מתהפכים: 6 <b>מושגים</b> ו-6 <b>דוגמאות</b>. בהתחלה כל השלטים גלויים לכמה שניות – <b>שננו איפה כל אחד</b>. אחר כך הם יתהפכו, ותצטרכו למצוא כל מושג עם הדוגמה שלו.</p><p>טעיתם? זה בסדר. אפשר ללחוץ "הציצו שוב". הרמזים בשדה התעופה מסבירים את כל המושגים.</p>${found(rid, c.id) ? piece : ''}<button class="btn primary go">${found(rid, c.id) ? 'לשחק שוב ▶' : 'מתחילים ▶'}</button>`;
    wrap.querySelector('.go').addEventListener('click', start);
  };
  const start = () => {
    deck = shuffle([...MEMO.map((m, i) => ({ i, t: 'k' })), ...MEMO.map((m, i) => ({ i, t: 'e' }))]); first = null; busy = true; pairs = 0; tries = 0;
    wrap.innerHTML = `<div class="mm-head"><span class="mm-st">שננו! השלטים יתהפכו בעוד <b class="mm-cd"></b></span><span class="mm-score">זוגות: <b class="mm-p">0</b>/6</span></div><div class="mm-wall">${deck.map((d, i) => `<button class="mm" type="button" data-i="${i}" data-k="${d.i}" aria-label="שלט ${i + 1}"><span class="mm-in"><span class="mm-back"><span>✈️</span></span><span class="mm-front ${d.t}">${d.t === 'k' ? `<b>${MEMO[d.i].k}</b>` : `<span class="mi">${MEMO[d.i].ic}</span><span>${MEMO[d.i].e}</span>`}</span></span></button>`).join('')}</div><div class="row center mm-btns"><button class="btn ghost again" type="button" disabled>👀 הציצו שוב</button></div><div class="feedback"></div>`;
    const cards = $$('.mm', wrap); cards.forEach(b => b.classList.add('up'));
    const t0 = performance.now(); const cd = wrap.querySelector('.mm-cd');
    const tick = () => { if (!wrap.isConnected) return; const left = PK - (performance.now() - t0); if (left > 0) { cd.textContent = Math.ceil(left / 1000); peekT = requestAnimationFrame(tick); } else { cards.forEach(b => b.classList.remove('up')); busy = false; wrap.querySelector('.mm-st').textContent = 'מצאו זוגות: לחצו על מושג ועל הדוגמה שלו'; wrap.querySelector('.again').disabled = false; } };
    tick();
    wrap.querySelector('.mm-wall').addEventListener('click', e => { const b = e.target.closest('.mm'); if (!b || busy || b.classList.contains('up') || b.classList.contains('done')) return; flip(b); });
    wrap.querySelector('.again').addEventListener('click', () => { if (busy) return; busy = true; SND.sfx('click'); const hid = cards.filter(b => !b.classList.contains('done')); hid.forEach(b => b.classList.add('up')); first = null; setTimeout(() => { hid.forEach(b => b.classList.remove('up')); busy = false; }, PK * 0.6); });
  };
  const flip = b => {
    SND.sfx('tick'); b.classList.add('up');
    if (!first) { first = b; return; }
    const a = first; first = null; tries++;
    if (a.dataset.k === b.dataset.k) {
      a.classList.add('done'); b.classList.add('done'); pairs++; wrap.querySelector('.mm-p').textContent = pairs; SND.sfx('ok');
      const f = wrap.querySelector('.feedback'); f.className = 'feedback good'; f.textContent = `זוג! ${MEMO[+a.dataset.k].k} ✓`;
      if (pairs === 6) done();
    } else {
      busy = true; const f = wrap.querySelector('.feedback'); f.className = 'feedback bad'; f.textContent = 'לא זוג. הציצו שוב או נסו זוג אחר 🙂'; SND.sfx('wrong');
      setTimeout(() => { a.classList.remove('up'); b.classList.remove('up'); busy = false; }, 1300);
    }
  };
  const done = () => {
    okFx(''); const st = wrap.querySelector('.mm-st'); st.innerHTML = `<b>כל הכבוד! מצאתם את כל 6 הזוגות ב-${tries} ניסיונות 🎉</b>`;
    wrap.querySelector('.mm-btns').innerHTML = ''; wrap.querySelector('.feedback').insertAdjacentHTML('afterend', piece); markFound(rid, c.id); if (!isSolved(rid)) { const gb = h('button', { class: 'btn primary wide', onclick: () => { closeModal(); openLock(rid); } }, `✈️ ל${spot(rid).lock.title}`); wrap.querySelector('.piece').after(gb); }
  };
  intro();
  openModal({ title: '🛫 ' + c.title, node: wrap, wide: true, buttons: [{ t: 'סגירה' }], onClose: () => cancelAnimationFrame(peekT) });
}
/* ======================= מנעולים ======================= */
function openLock(rid) {
  const sp = spot(rid), isOff = rid === 'office';
  if (isSolved(rid) && !isOff) { openModal({ title: sp.lock.title, html: `<p class="big">✓ כבר פתרתם! המילה: <b>${sp.word}</b> · הספרה: <b>${sp.digit}</b></p>`, buttons: [{ t: 'סגירה' }] }); return; }
  if (!TEACHER) {
    if (isOff && !ROOMS.every(r => isSolved(r.id))) { toast('🔒 צריך את כל חמש הספרות כדי לפתוח את הכספת'); return; }
    if (!allFound(rid)) { SND.sfx('wrong'); const left = cl4(rid).filter(c => !found(rid, c.id)).length; const g = sp.clues.find(c => c.gate); if (!left && g) { toast(`🔒 קודם פתרו את ${g.title}`); return; } toast(`🔒 המנעול סגור. נשארו עוד ${left} ${left === 1 ? 'רמז' : 'רמזים'} למצוא כאן`); return; }
  }
  const L = sp.lock, key = rid;
  if (L.type === 'safe') return lockSafe(rid, sp, L, key);
  lockSteps(rid, sp, L, key);
}
function lockShell(sp, L, key, node, extra = {}) {
  const wrap = h('div', { class: 'lock', 'data-key': key }); if (L.prompt) wrap.appendChild(h('p', { class: 'lprompt' }, L.prompt));
  if (L.pieces) wrap.appendChild(h('div', { class: 'pieces' }, found(sp.id, 'board') ? '🧩 מלוח ההמראות: כל הזוגות הם חלק מתהליך אחד שבו העולם נעשה מחובר.' : '🧩 עוד לא השלמתם את לוח ההמראות'));
  const body = h('div', { class: 'lbody' }); body.appendChild(node); wrap.appendChild(body);
  wrap.appendChild(h('div', { class: 'feedback', 'aria-live': 'polite' })); wrap.appendChild(hintBox(key, L.hints));
  openModal({ title: '🔐 ' + L.title, node: wrap, wide: true, ...extra }); applyCool(); return wrap;
}
function selectable(root) {
  let sel = null;
  const api = { get: () => sel, set: el => { if (sel) sel.classList.remove('sel'); sel = el; if (el) el.classList.add('sel'); }, clear: () => api.set(null) };
  return api;
}
// מנעול רב-שלבי: כל שלב הוא מיון / התאמה / שאלה פתוחה / בחירה / סידור מגירות
function lockSteps(rid, sp, L, key) {
  const node = h('div', { class: 'steps' });
  const N = L.stages.length;
  const run = () => {
    const i = Math.min(S.step[key] || 0, N - 1); const st = L.stages[i];
    const fb = node.closest('.lock') && node.closest('.lock').querySelector('.feedback'); if (fb && fb.classList.contains('good') && (S.step[key] || 0) > 0 && !node.dataset.keepfb) { }
    node.innerHTML = N > 1 ? `<div class="stepdots">${L.stages.map((_, k) => `<span class="${k < i ? 'done' : k === i ? 'cur' : ''}">${k + 1}</span>`).join('')}</div>` : '';
    const box = h('div', { class: 'stage' }); node.appendChild(box);
    const ok = (msg) => { if (i + 1 < N) { S.step[key] = i + 1; save(); okFx(msg + ' עוברים לשלב הבא…'); setTimeout(run, 900 * (TS < 1 ? 0.3 : 1)); } else { S.step[key] = N; save(); okFx(msg); successNext(node, sp); } };
    ({ sort: stageSort, match: stageMatch, text: stageText, mc: stageMc, order: stageOrder })[st.type](box, st, key, ok);
  };
  run(); lockShell(sp, L, key, node);
}
function stageSort(box, L, key, ok) {
  box.className = 'stage sort';
  const order = L.items.map((_, i) => i).sort(() => Math.random() - 0.5);
  box.innerHTML = `<p class="lprompt">${L.prompt}</p><div class="pool zone" data-z="-1"></div><div class="cols">${L.cols.map((c, i) => `<div class="col zone" data-z="${i}"><div class="colh">${c}</div><div class="colb"></div></div>`).join('')}</div><div class="movebar" hidden><span>להעביר ל:</span>${L.cols.map((c, i) => `<button class="btn mv" data-z="${i}">${c}</button>`).join('')}</div><button class="btn primary check" disabled>בדיקה ✔</button>`;
  const pool = box.querySelector('.pool'); const sel = selectable(box); const mb = box.querySelector('.movebar');
  const _set = sel.set; sel.set = el => { _set(el); mb.hidden = !el; };
  mb.querySelectorAll('.mv').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); if (sel.get()) place(sel.get(), +b.dataset.z); }));
  order.forEach(i => { const it = h('div', { class: 'card', draggable: 'true', 'data-i': i, tabindex: '0' }, `📝 ${L.items[i].t}`); pool.appendChild(it); });
  const place = (card, z) => { (z < 0 ? pool : box.querySelector(`.col[data-z="${z}"] .colb`)).appendChild(card); sel.clear(); SND.sfx('click'); upd(); };
  const upd = () => { box.querySelector('.check').disabled = pool.children.length > 0; box.querySelectorAll('.card').forEach(c => c.classList.remove('ok', 'no')); };
  box.addEventListener('click', e => {
    const card = e.target.closest('.card'), zone = e.target.closest('.zone'), cs = sel.get();
    if (card) { if (cs && cs !== card && cs.closest('.zone') !== zone) { place(cs, +zone.dataset.z); return; } sel.set(cs === card ? null : card); SND.sfx('click'); return; }
    if (zone && cs) place(cs, +zone.dataset.z);
  });
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('card')) sel.set(e.target); });
  box.addEventListener('dragstart', e => { const c = e.target.closest('.card'); if (c) { sel.set(c); e.dataTransfer.setData('text/plain', c.dataset.i); } });
  box.querySelectorAll('.zone').forEach(z => { z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('over'); }); z.addEventListener('dragleave', () => z.classList.remove('over')); z.addEventListener('drop', e => { e.preventDefault(); z.classList.remove('over'); const c = sel.get(); if (c) place(c, +z.dataset.z); }); });
  box.querySelector('.check').addEventListener('click', () => {
    if (coolLeft(key)) return;
    let n = 0; box.querySelectorAll('.col').forEach(col => col.querySelectorAll('.card').forEach(c => { if (L.items[c.dataset.i].c === +col.dataset.z) n++; }));
    if (n === L.items.length) { box.querySelectorAll('.card').forEach(c => c.classList.add('ok')); box.querySelector('.check').remove(); ok('מושלם! הכל במקום 🎉'); }
    else lockWrong(key, box.querySelector('.cols'), `${n} מתוך ${L.items.length} במקום הנכון. נסו שוב 🙂`);
  });
}
function stageMatch(box, L, key, ok) {
  box.className = 'stage match'; const sel = selectable(box); const asg = {};
  box.innerHTML = `<p class="lprompt">${L.prompt}</p><div class="chips">${L.chips.map(c => `<button class="chip" draggable="true" data-c="${c}">${c}</button>`).join('')}</div><div class="mrows">${L.rows.map((r, i) => `<div class="mrow" data-f="${i}"><span class="mt">📝 ${r.t}</span><span class="slot">?</span></div>`).join('')}</div><button class="btn primary check" disabled>בדיקה ✔</button>`;
  const draw = () => { box.querySelectorAll('.mrow').forEach(f => { const v = asg[f.dataset.f]; const s = f.querySelector('.slot'); s.textContent = v || '?'; s.classList.toggle('full', !!v); f.classList.remove('ok', 'no'); }); box.querySelectorAll('.chip').forEach(c => c.classList.toggle('used', Object.values(asg).includes(c.dataset.c))); box.querySelector('.check').disabled = Object.keys(asg).length < L.rows.length; };
  const assign = (f, chip) => { for (const k in asg) if (asg[k] === chip) delete asg[k]; asg[f] = chip; sel.clear(); SND.sfx('click'); draw(); };
  box.addEventListener('click', e => { const chip = e.target.closest('.chip'); const f = e.target.closest('.mrow'); if (chip) { sel.set(chip === sel.get() ? null : chip); return; } if (f) { if (sel.get()) assign(f.dataset.f, sel.get().dataset.c); else if (asg[f.dataset.f]) { delete asg[f.dataset.f]; draw(); } else toast('בחרו קודם מושג מהרשימה למעלה'); } });
  box.addEventListener('dragstart', e => { const c = e.target.closest('.chip'); if (c) { sel.set(c); e.dataTransfer.setData('text/plain', c.dataset.c); } });
  box.querySelectorAll('.mrow').forEach(f => { f.addEventListener('dragover', e => { e.preventDefault(); f.classList.add('over'); }); f.addEventListener('dragleave', () => f.classList.remove('over')); f.addEventListener('drop', e => { e.preventDefault(); f.classList.remove('over'); if (sel.get()) assign(f.dataset.f, sel.get().dataset.c); }); });
  box.querySelector('.check').addEventListener('click', () => {
    if (coolLeft(key)) return;
    const n = L.rows.filter((r, i) => asg[i] === r.a).length;
    if (n === L.rows.length) { box.querySelectorAll('.mrow').forEach(f => f.classList.add('ok')); box.querySelector('.check').remove(); ok('מעולה! כל המושגים במקום 🎉'); }
    else lockWrong(key, box.querySelector('.mrows'), `${n} מתוך ${L.rows.length} נכונים. קראו שוב את הרמזים מהקניון 🙂`);
  });
  draw();
}
function stageText(box, L, key, ok) {
  box.className = 'stage tlock';
  box.innerHTML = `<p class="lprompt">${L.prompt}</p>`;
  const form = h('form', { class: 'row tform' }, `<input type="text" class="ans" autocomplete="off" placeholder="הקלידו את התשובה כאן" aria-label="תשובה"><button class="btn primary" type="submit">בדיקה ✔</button>`);
  box.appendChild(form);
  form.addEventListener('submit', e => { e.preventDefault(); if (coolLeft(key)) return; const v = form.querySelector('.ans').value.trim(); if (!v) return;
    if (accepts(v, L.accept)) { form.querySelector('.ans').disabled = true; form.querySelector('button').remove(); ok('נכון מאוד! 🎉'); return; }
    const nk = Object.keys(L.near || {}).sort((a, b) => b.length - a.length).find(k => norm(v).includes(norm(k))); lockWrong(key, form, nk ? L.near[nk] : 'לא נכון 🙂 נסו לחבר את כל הרמזים מהמקום'); });
}
function stageMc(box, L, key, ok) {
  box.className = 'stage mc';
  box.innerHTML = `<p class="lprompt">${L.q}</p><div class="row opts">${L.options.map((o, i) => `<button class="btn opt" data-i="${i}">${o}</button>`).join('')}</div>`;
  box.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { if (coolLeft(key)) return; if (+b.dataset.i === L.answer) { b.classList.add('right'); box.querySelectorAll('.opt').forEach(x => x.disabled = true); ok('נכון! 🎉'); } else lockWrong(key, b, L.wrong); }));
}
function stageOrder(box, L, key, ok) {
  box.className = 'stage freud';
  const N = L.items.length;
  let order = (S.step.order && S.step.order.length === N) ? [...S.step.order] : [...L.startOrder];
  box.innerHTML = `<p class="lprompt">${L.prompt}</p><p class="dhow"><span aria-hidden="true">⠿</span> גררו את המגירות או לחצו על החצים כדי לשנות את הסדר</p><div class="drawers"></div><button class="btn primary check">בדיקה ✔</button>`;
  const node = box; box = node.querySelector('.drawers'); const dr = box;
  const commit = () => { S.step.order = [...order]; save(); };
  const draw = () => { box.innerHTML = order.map((id, i) => { const st = L.items.find(s => s.id === id); return `<div class="drawer" data-id="${id}" data-i="${i}"><div class="dtop"><span class="dgrip" title="גררו כדי להזיז" aria-hidden="true">⠿</span><span class="dnum">מגירה ${i + 1}</span></div><span class="dsvg">${st.ic}</span><span class="dcap">${st.cap}</span><div class="darrows"><button type="button" class="dmv" data-d="-1" aria-label="הזזת המגירה למקום ${i}"${i === 0 ? ' disabled' : ''}><span class="ah">▶</span><span class="av">▲</span></button><button type="button" class="dmv" data-d="1" aria-label="הזזת המגירה למקום ${i + 2}"${i === N - 1 ? ' disabled' : ''}><span class="ah">◀</span><span class="av">▼</span></button></div></div>`; }).join(''); };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flipDraw = (focusId, focusD) => { // redraw with a smooth slide from the old places
      const before = {}; box.querySelectorAll('.drawer').forEach(d => { before[d.dataset.id] = d.getBoundingClientRect(); });
      draw();
      if (!reduce) box.querySelectorAll('.drawer').forEach(d => { const b = before[d.dataset.id]; if (!b) return; const a = d.getBoundingClientRect(); const dx = b.left - a.left, dy = b.top - a.top; if (!dx && !dy) return;
        d.style.transition = 'none'; d.style.transform = `translate(${dx}px,${dy}px)`; d.getBoundingClientRect(); d.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)'; d.style.transform = ''; d.addEventListener('transitionend', () => { d.style.transition = ''; }, { once: true }); });
      if (focusId) { const d = box.querySelector(`.drawer[data-id="${focusId}"]`); const b = d && (d.querySelector(`.dmv[data-d="${focusD}"]:not(:disabled)`) || d.querySelector('.dmv:not(:disabled)')); if (b) b.focus({ preventScroll: true }); if (d) { d.classList.add('moved'); setTimeout(() => d.classList.remove('moved'), 450); } }
    };
    // arrows
    box.addEventListener('click', e => { const b = e.target.closest('.dmv'); if (!b || box.classList.contains('done') || box.classList.contains('dragging')) return;
      const d = b.closest('.drawer'), i = +d.dataset.i, j = i + (+b.dataset.d); if (j < 0 || j > N - 1) return;
      [order[i], order[j]] = [order[j], order[i]]; commit(); SND.sfx('click'); flipDraw(d.dataset.id, b.dataset.d); });
    // drag & drop (mouse: whole drawer; touch/pen: the ⠿ handle)
    const scroller = () => { let el = box.parentElement; while (el && el !== document.body) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) return el; el = el.parentElement; } return null; };
    let drag = null;
    box.addEventListener('pointerdown', e => {
      if (box.classList.contains('done') || drag || e.button > 0) return;
      const d = e.target.closest('.drawer'); if (!d || e.target.closest('.dmv')) return;
      const onGrip = !!e.target.closest('.dgrip');
      if (e.pointerType !== 'mouse' && !onGrip) return;
      if (onGrip) e.preventDefault();
      const els = [...box.querySelectorAll('.drawer')], br = box.getBoundingClientRect();
      const slots = els.map(x => { const r = x.getBoundingClientRect(); return { x: r.left - br.left, y: r.top - br.top, w: r.width, h: r.height }; });
      const from = +d.dataset.i, r0 = slots[from];
      drag = { d, els, slots, from, to: from, id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, gx: e.clientX - br.left - r0.x, gy: e.clientY - br.top - r0.y, started: onGrip, sc: scroller(), raf: 0 };
      if (onGrip) startDrag();
      window.addEventListener('pointermove', onMove, { passive: false }); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    });
    const startDrag = () => {
      drag.started = true; box.classList.add('dragging'); drag.d.classList.add('lifted');
      drag.ph = document.createElement('div'); drag.ph.className = 'dph'; box.appendChild(drag.ph); placePh();
      drag.els.forEach(x => { if (x !== drag.d) x.style.transition = reduce ? 'none' : 'transform .22s cubic-bezier(.2,.8,.2,1)'; });
      try { navigator.vibrate && navigator.vibrate(12); } catch (e) { }
      SND.sfx('click'); const loop = () => { if (!drag) return; autoScroll(); drag.raf = requestAnimationFrame(loop); }; drag.raf = requestAnimationFrame(loop);
    };
    const placePh = () => { const s = drag.slots[drag.to]; Object.assign(drag.ph.style, { left: s.x + 'px', top: s.y + 'px', width: s.w + 'px', height: s.h + 'px' }); };
    const layout = () => {
      const br = box.getBoundingClientRect(), s0 = drag.slots[drag.from];
      const px = drag.cx - br.left - drag.gx, py = drag.cy - br.top - drag.gy;
      drag.d.style.transform = `translate(${px - s0.x}px,${py - s0.y}px) scale(1.05) rotate(-1.5deg)`;
      const mx = px + s0.w / 2, my = py + s0.h / 2; let best = drag.to, bd = Infinity;
      drag.slots.forEach((s, k) => { const dd = Math.hypot(s.x + s.w / 2 - mx, s.y + s.h / 2 - my); if (dd < bd) { bd = dd; best = k; } });
      if (best !== drag.to) { drag.to = best; placePh(); SND.sfx('click');
        const tmp = order.filter((_, k) => k !== drag.from); tmp.splice(drag.to, 0, order[drag.from]);
        drag.els.forEach((x, k) => { if (x === drag.d) return; const nk = tmp.indexOf(order[k]); const a = drag.slots[k], b = drag.slots[nk]; x.style.transform = nk === k ? '' : `translate(${b.x - a.x}px,${b.y - a.y}px)`; }); }
    };
    const autoScroll = () => { const sc = drag && drag.started && drag.sc; if (!sc) return; const r = sc.getBoundingClientRect(), m = 56; let v = 0;
      if (drag.cy < r.top + m) v = -Math.ceil((r.top + m - drag.cy) / 4); else if (drag.cy > r.bottom - m) v = Math.ceil((drag.cy - (r.bottom - m)) / 4);
      if (v) { const t = sc.scrollTop; sc.scrollTop += v; if (sc.scrollTop !== t) layout(); } };
    const onMove = e => { if (!drag || e.pointerId !== drag.id) return; drag.cx = e.clientX; drag.cy = e.clientY;
      if (!drag.started) { if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return; startDrag(); }
      e.preventDefault(); layout(); };
    const onUp = e => { if (!drag || e.pointerId !== drag.id) return;
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      const g = drag; drag = null; cancelAnimationFrame(g.raf); if (!g.started) return;
      const a = g.slots[g.from], b = g.slots[g.to];
      g.d.classList.remove('lifted'); g.d.classList.add('dropping'); g.d.style.transition = reduce ? 'none' : 'transform .2s ease-out'; g.d.style.transform = `translate(${b.x - a.x}px,${b.y - a.y}px)`;
      const fin = () => { if (g.ph) g.ph.remove(); box.classList.remove('dragging');
        if (g.to !== g.from) { const id = order.splice(g.from, 1)[0]; order.splice(g.to, 0, id); commit(); }
        draw(); if (g.to !== g.from) { const nd = box.querySelector(`.drawer[data-id="${g.d.dataset.id}"]`); if (nd) { nd.classList.add('moved'); setTimeout(() => nd.classList.remove('moved'), 450); } } };
      if (reduce) fin(); else setTimeout(fin, 210);
    };
  node.querySelector('.check').addEventListener('click', () => {
    if (coolLeft(key)) return;
    const right = L.items.map(s => s.id); const n = order.filter((id, i) => id === right[i]).length;
    if (n === right.length) { dr.classList.add('done'); dr.querySelectorAll('.darrows,.dgrip').forEach(x => x.remove()); dr.querySelectorAll('.drawer').forEach((d, i) => d.insertAdjacentHTML('beforeend', `<span class="dname">${L.items[i].name}</span>`)); node.querySelector('.check').remove(); node.querySelector('.dhow')?.remove(); SND.sfx('unlock'); ok('המגירות נפתחו! 🎉 מהמשפחה המסורתית, דרך המודרנית, ועד הפוסט-מודרנית.'); }
    else lockWrong(key, dr, `${n} מתוך ${right.length} מגירות במקום. נסו שוב 🙂`);
  });
  draw();
}
function letterLights(node, sp) {
  const scr = [...sp.word].sort(() => 0.5 - Math.random());
  const box = h('div', { class: 'letters' }, scr.map(l => `<span>${l}</span>`).join('')); node.querySelector('.check').replaceWith(box);
  $$('span', box).forEach((s, i) => setTimeout(() => { s.classList.add('lit'); SND.sfx('type'); }, 300 + i * 350));
  setTimeout(() => { box.insertAdjacentHTML('afterend', '<p class="center">האותיות נדלקו – אבל מה המילה? קחו את זכוכית המגדלת…</p>'); const b = h('button', { class: 'btn primary wide', onclick: () => reveal(sp) }, '🔍 לחשיפת המילה'); node.appendChild(b); }, 500 + scr.length * 350);
}
function successNext(node, sp, msg) { const b = h('button', { class: 'btn primary wide', onclick: () => reveal(sp) }, '🔍 לחשיפת המילה והספרה'); if (msg) node.appendChild(h('p', { class: 'center' }, msg)); node.appendChild(b); b.scrollIntoView({ block: 'nearest' }); }



function lockSafe(rid, sp, L, key) {
  const node = h('div', { class: 'safe' }); let code = ''; const LEN = SAFE_CODE.length; const blank = '_'.repeat(LEN);
  node.innerHTML = `<p class="lprompt">על הכספת מקלדת: הקלידו קוד של ${LEN} ספרות – הספרה מכל מקום, לפי סדר המקומות.</p><div class="wordpins small">${ROOMS.map((r, i) => `<span class="pin"><small>${r.n}. ${r.name}</small>${S.words[i] ? `${S.words[i]} · <b>${r.digit}</b>` : '?'}</span>`).join('')}</div><div class="sdisp">${blank}</div><div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✔'].map(k => `<button class="btn key" data-k="${k}">${k}</button>`).join('')}</div>`;
  const disp = node.querySelector('.sdisp'); const draw = () => { disp.textContent = (code + blank).slice(0, LEN); };
  const press = k => { if (coolLeft(key)) return; if (k === '⌫') code = code.slice(0, -1); else if (k === '✔') return check(); else if (code.length < LEN) code += k; SND.sfx('tick'); draw(); };
  const check = () => { if (code === SAFE_CODE) { SND.sfx('unlock'); disp.classList.add('open'); disp.textContent = '✔ נפתח'; finishGame(); } else { if (code.length < LEN) wrongFx(disp, `צריך ${LEN} ספרות`); else lockWrong(key, disp, 'הכספת לא נפתחה. בדקו את הסדר של הספרות 🙂'); code = ''; setTimeout(draw, 500); } };
  node.querySelectorAll('.key').forEach(b => b.addEventListener('click', () => press(b.dataset.k)));
  const kh = e => { if ($('#modal').hidden) return document.removeEventListener('keydown', kh); if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); else if (e.key === 'Enter') press('✔'); };
  document.addEventListener('keydown', kh);
  lockShell(sp, L, key, node);
}
/* ======================= זכוכית מגדלת ======================= */
function reveal(sp) {
  const word = sp.word;
  const wrap = h('div', { class: 'mag' });
  wrap.innerHTML = `<p class="center">העבירו את זכוכית המגדלת על הדף ומצאו את המילה הנסתרת</p><div class="parch"><div class="w faint">${word}</div><div class="w sharp">${word}</div><div class="lens"><span></span></div></div><div class="mag-after" hidden></div><button class="btn ghost giveup" hidden>לא מצליחים? חשפו את המילה</button>`;
  const par = wrap.querySelector('.parch'), sharp = wrap.querySelector('.sharp');
  const seen = new Set(); let done = false;
  const move = (x, y) => { par.style.setProperty('--x', x + 'px'); par.style.setProperty('--y', y + 'px'); const wb = sharp.getBoundingClientRect(), pb = par.getBoundingClientRect(); const rx = x - (wb.left - pb.left), ry = y - (wb.top - pb.top); if (rx > -20 && rx < wb.width + 20 && ry > -40 && ry < wb.height + 40) { seen.add(Math.max(0, Math.min(9, Math.floor(rx / wb.width * 10)))); if (seen.size >= 7) finish(); } };
  par.addEventListener('pointermove', e => { const b = par.getBoundingClientRect(); move(e.clientX - b.left, e.clientY - b.top); });
  par.addEventListener('pointerdown', e => { par.setPointerCapture(e.pointerId); const b = par.getBoundingClientRect(); move(e.clientX - b.left, e.clientY - b.top); });
  const finish = () => {
    if (done) return; done = true; par.classList.add('revealed'); SND.sfx('win');
    const a = wrap.querySelector('.mag-after'); a.hidden = false; wrap.querySelector('.giveup').hidden = true;
    a.innerHTML = `<p class="big center">מצאתם את המילה: <b class="theword">${word}</b> ✨</p><p class="center digitline">ובפינת הדף, בעיפרון: <span class="dg">${sp.digit}</span> ← הספרה לכספת</p><p class="center">${sp.topic}</p>`;
    a.appendChild(h('button', { class: 'btn primary wide', onclick: () => collect(sp) }, '📥 שמרו במגש למעלה'));
  };
  setTimeout(() => { const g = wrap.querySelector('.giveup'); if (g && !done) { g.hidden = false; g.addEventListener('click', finish); } }, 6000 * (TS < 1 ? 0.2 : 1));
  openModal({ title: '🔍 זכוכית המגדלת', node: wrap, wide: true, cls: 'magcard', onClose: () => { if (done && !isSolved(sp.id)) collect(sp, true); } });
  requestAnimationFrame(() => { const b = par.getBoundingClientRect(); move(b.width * 0.85, b.height * 0.25); });
}
function collect(sp, silent) {
  if (isSolved(sp.id)) { closeModal(); return; }
  const from = $('#mbody .theword'); const slot = $(`#tray .slot[data-n="${sp.n}"]`);
  if (from && slot && !silent) { const a = from.getBoundingClientRect(), b = slot.getBoundingClientRect(); const fly = h('div', { class: 'fly' }, sp.word); document.body.appendChild(fly); fly.style.left = a.left + 'px'; fly.style.top = a.top + 'px'; requestAnimationFrame(() => { fly.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(.6)`; fly.style.opacity = '.3'; }); setTimeout(() => fly.remove(), 900); }
  S.solved.push(sp.id); S.words[sp.n - 1] = sp.word; save();
  if (!silent) closeModal();
  setTimeout(() => { drawTray(); const s = $(`#tray .slot[data-n="${sp.n}"]`); if (s) s.classList.add('pop'); }, silent ? 0 : 800);
  refreshMarkers(); renderPanel();
  const next = ROOMS[sp.n]; setTimeout(() => { toast(next ? `🔓 ${next.name} נפתח! חוזרים למפה…` : '🔓 הספרייה נפתחה! הכספת מחכה…', 3000); setTimeout(goHub, 1400); }, silent ? 200 : 900);
}
function drawTray() { const t = $('#tray'); t.innerHTML = ROOMS.map(r => `<div class="slot ${S.words[r.n - 1] ? 'full' : ''}" data-n="${r.n}" title="${r.name}" style="--c:${r.color}"><span class="si">${r.icon}</span><span class="sw">${S.words[r.n - 1] || '?'}</span>${S.words[r.n - 1] ? `<span class="sd">${r.digit}</span>` : ''}</div>`).join(''); }
/* ======================= סיום ותעודה ======================= */
function finishGame() {
  if (!S.finishMs) { S.finishMs = Date.now(); save(); }
  setTimeout(() => { closeModal(); playClip('finale', [[0, '🔓 הכספת נפתחה!'], [1.5, 'ומבין המדפים מופיעה… המורה נוגה, עם יומן התצפית!'], [3.3, '"לא נעלמתי. צפיתי בכם כל הזמן – ועשיתם סוציולוגיה!"']], showEnding, 6.8); }, 900);
}
function showEnding() {
  SND.sfx('win');
  const e = $('#ending'); const nh = totalHints(); const hl = nh ? ` · רמזים: <b>${nh}</b> (כולל ${nh} ${nh === 1 ? 'דקה' : 'דקות'} תוספת)` : ' · בלי רמזים! 🌟'; const tm = S.timer.mode === 'none' ? `<div class="etime">💡 רמזים: <b>${nh}</b></div>` : `<div class="etime">⏱ זמן: <b>${fmt(gameMs())}</b>${hl}</div>`;
  e.innerHTML = `<div class="paper"><div class="mast">${STORY.masthead}</div><div class="dateline">עיתון בית הספר · מהדורה מיוחדת · סוף היום הראשון</div>
  <h1>${ENDING.headline}</h1><h2>${ENDING.sub}</h2>
  <div class="ecols"><div><p>${ENDING.body.replace('קבוצת הסוציולוגים הצעירה', `קבוצת <b>"${esc(S.group || 'הסוציולוגים')}"</b>`)}</p><p class="sentence">${ENDING.sentence}</p></div>
  <div><img class="endpic" src="${M('img/sc-finale.webp')}?v=2" alt="המורה נוגה יוצאת מאחורי מדף הספרים עם יומן התצפית, ושי ואלמה מופתעים"><p class="quote">${ENDING.quote}</p></div></div>
  <div class="ewords">${S.words.map((w, i) => `<span>${w}<b>${ROOMS[i].digit}</b></span>`).join('')}</div>${tm}
  <div class="row center"><button class="btn primary" id="certBtn">🖨️ תעודה לקבוצה</button><button class="btn ghost" id="endBack">חזרה לספרייה</button></div></div><canvas id="confetti"></canvas>`;
  e.hidden = false; $('#certBtn').addEventListener('click', printCert); $('#endBack').addEventListener('click', () => { e.hidden = true; });
  confetti($('#confetti'));
}
function confetti(cv) { const c = cv.getContext('2d'); const W = cv.width = innerWidth, H = cv.height = innerHeight; const P = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: -Math.random() * H, v: 2 + Math.random() * 3, r: 4 + Math.random() * 6, c: ['#ff7a59', '#e94f8a', '#2bb3a3', '#8a63d2', '#f2b705', '#4361ee'][Math.random() * 6 | 0], a: Math.random() * 6 })); let n = 0; const f = () => { c.clearRect(0, 0, W, H); P.forEach(p => { p.y += p.v; p.a += 0.1; c.fillStyle = p.c; c.save(); c.translate(p.x + Math.sin(p.a) * 10, p.y); c.rotate(p.a); c.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); c.restore(); }); if (++n < 420 && !$('#ending').hidden) requestAnimationFrame(f); else c.clearRect(0, 0, W, H); }; f(); }
function printArea(html, cls) { const p = $('#print-area'); p.innerHTML = html; document.body.classList.add('printing', cls); const done = () => { document.body.classList.remove('printing', cls); window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); setTimeout(() => window.print(), 300); }
function certHTML() {
  const d = new Date(S.finishMs || Date.now()); const ds = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  return `<div class="cert"><div class="cin"><img src="img/logo.png" alt="" class="clogo"><div class="cmast">${STORY.masthead}</div><h1>תעודת סוציולוגים מתחילים</h1><p class="cto">מוענקת לקבוצת</p><div class="cgroup">${esc(S.group || 'הסוציולוגים')}</div>
  <p class="cwhy">על פתרון תעלומת המורה הנעלמת – ועל המחקר הסוציולוגי הראשון שלכם</p><div class="cwords">${S.words.map(w => `<span>${w}</span>`).join('')}</div>
  <p class="cmeta">${S.timer.mode === 'none' ? '' : `זמן: <b>${fmt(gameMs())}</b> · `}רמזים שנפתחו: <b>${totalHints()}</b>${totalHints() ? ` (+${totalHints()} דק')` : ''} · תאריך: ${ds}</p><div class="csig"><div>${avaImg('noga')}<span>המורה נוגה</span></div><div>${avaImg('shai')}<span>שי</span></div><div>${avaImg('alma')}<span>אלמה</span></div></div><div class="ccredit">יצרה: עינבל אריאלי</div></div></div>`;
}
function printCert() { // תעודה על המסך (מותאמת לטלפון) + כפתור הדפסה
  let v = $('#certView'); if (!v) { v = h('div', { id: 'certView', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'תעודה' }); document.body.appendChild(v); }
  v.innerHTML = `<div class="cv-bar"><button class="btn primary" type="button" data-a="print">🖨️ הדפסה / שמירה כ-PDF</button><button class="btn ghost" type="button" data-a="close">✕ סגירה</button></div><div class="cv-wrap">${certHTML()}</div>`;
  v.hidden = false;
  v.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'close') v.hidden = true; if (b.dataset.a === 'print') printArea(certHTML(), 'p-cert'); };
}
/* ======================= מורה ======================= */
function teacherLogin() {
  const node = h('form', { class: 'row tform' }, '<input type="password" inputmode="numeric" class="tc" placeholder="קוד מורה" aria-label="קוד מורה" autocomplete="off"><button class="btn primary" type="submit">כניסה</button>');
  const wrap = h('div'); wrap.appendChild(h('p', {}, 'כניסה למורים: תשובות לכל החדרים, פתיחת חדרים ואיפוס התקדמות.')); wrap.appendChild(node); wrap.appendChild(h('div', { class: 'feedback' }));
  node.addEventListener('submit', e => { e.preventDefault(); if (node.querySelector('.tc').value.trim() === TEACHER_CODE) { TEACHER = true; sessionStorage.setItem('se_teacher', '1'); closeModal(); teacherPanel(); updTeacherBadge(); refreshMarkers(); renderPanel(); } else wrongFx(node, 'קוד שגוי'); });
  openModal({ title: '👩‍🏫 כניסת מורה', node: wrap });
}
function whereHTML(id) { const sp = spot(id), sc = SCN[id]; const nd = sc.spots.filter(s => s.decoy).length; return `<p class="where">🔎 חפצי הרמז: ${sp.clues.map(x => x.title).join(' · ')} <small>(ועוד ${nd} חפצי הסחה שמראים רק משפט קצר)</small></p>`; }
function stageAns(st) {
  if (st.type === 'mc') return `<p>שאלה: ${st.q}<br>תשובה: <b>${st.options[st.answer]}</b></p>`;
  if (st.type === 'text') return `<p>${st.prompt}<br>תשובה: <b>${st.accept[0]}</b> <small>(מתקבל גם: ${st.accept.slice(1).join(', ') || '—'}; בלי תלות ברווחים, באות ה\' ובאותיות סופיות, וטעות הקלדה קטנה)</small></p>`;
  if (st.type === 'sort') return `<p>${st.prompt}</p><table><tr>${st.cols.map(c => `<th>${c}</th>`).join('')}</tr><tr>${st.cols.map((c, i) => `<td>${st.items.filter(x => x.c === i).map(x => x.t).join('<br>')}</td>`).join('')}</tr></table>`;
  if (st.type === 'match') return `<p>${st.prompt.replace(/\(.*\)/, '')}</p><ul>${st.rows.map(r => `<li>${r.t} ← <b>${r.a}</b></li>`).join('')}</ul>`;
  if (st.type === 'order') return `<p>סדר המגירות (1 → 3): ${st.items.map((s, i) => `${i + 1}. <b>${s.name}</b> ("${s.cap}")`).join(' · ')}</p>`;
  return '';
}
function answersHTML() {
  return `<section class="ans"><h3>⏱ כללי המשחק</h3><p>הרמזים בכל מקום לא מסומנים: חפץ מנצנץ כשהעכבר מתקרב (בטלפון – נצנוץ עדין כל כמה שניות). בכל מקום יש גם 2 חפצי הסחה. כל מושג מוסבר בכרטיס רמז לפני שמשתמשים בו – התלמידים לא צריכים ידע קודם. תשובה שגויה במנעול נועלת אותו ל-15 שניות. רמזי המנעול: רמז 1 נפתח 45 שניות אחרי הכניסה, רמז 2 – 30 שניות אחרי פתיחת רמז 1, רמז 3 – אחרי 2 ניסיונות שגויים. כל רמז מוסיף דקה לזמן הקבוצה ומופיע בתעודה. במצב מורה אין המתנה, אין נעילה ואין תוספת זמן.</p></section>
  ${ROOMS.map(r => `<section class="ans"><h3>${r.n}. ${r.icon} ${r.name} → <b>${r.word}</b> · ספרה <b>${r.digit}</b></h3>${whereHTML(r.id)}${r.id === 'class' ? `<p>ההודעה המוצפנת על הלוח: "<b>${CIPHER_MSG}</b>" (כתב הסתרים מהחדר המקורי).</p>` : ''}${r.id === 'family' ? `<p>התשבץ באלבום (המילים וההגדרות מהחדר המקורי): ${XWORD.words.map(w => `${w.clue} = <b>${w.w}</b>`).join(' · ')}. האותיות הצבועות: מ, ש, פ, ח, ה → <b>משפחה</b>.</p>` : ''}${r.id === 'airport' ? `<p>לוח ההמראות (משחק זיכרון, חובה לפני המנעול): ${MEMO.map(m => `${m.k} ↔ ${m.e}`).join(' · ')}</p>` : ''}${r.lock.stages.map((s, i) => `<div class="stg"><b>${r.lock.stages.length > 1 ? 'שלב ' + (i + 1) + ': ' : ''}</b>${stageAns(s)}</div>`).join('')}</section>`).join('')}
  <section class="ans"><h3>🔐 הכספת בספרייה</h3>${whereHTML('office')}<p>הספרות לפי סדר המקומות: ${ROOMS.map(r => `${r.word} = ${r.digit}`).join(' · ')} → קוד הכספת: <b class="code">${SAFE_CODE}</b></p></section>`;
}
function teacherPanel() {
  const CK = getClock();
  const node = h('div', { class: 'teacher' });
  node.innerHTML = `<div class="row tbtns"><button class="btn primary" data-a="print">🖨️ דף תשובות להדפסה</button><button class="btn" data-a="reset">🔄 איפוס התקדמות לקבוצה הבאה</button><button class="btn ghost" data-a="exit">יציאה ממצב מורה</button></div>
  <p class="tnote">במצב מורה כל המקומות פתוחים, המנעולים נפתחים בלי לחפש רמזים, כל הרמזים גלויים בלי המתנה ובלי תוספת זמן, ואין נעילה של 15 שניות. המצב נשמר רק בלשונית הזו.</p>
  <h3>⏱ שעון לקבוצות</h3><div class="tclock"><p class="tnote">ברירת המחדל: שעון עצר. ההגדרה נשמרת במכשיר הזה וחלה על כל קבוצה חדשה שמתחילה בו. התלמידים לא בוחרים שעון.</p>
   <div class="row"><label class="radio"><input type="radio" name="tcm" value="stopwatch" ${CK.mode === 'stopwatch' ? 'checked' : ''}> ⏱ שעון עצר</label><label class="radio"><input type="radio" name="tcm" value="countdown" ${CK.mode === 'countdown' ? 'checked' : ''}> ⏳ ספירה לאחור <select class="tcmins" aria-label="דקות">${[15, 20, 25, 30, 35, 40, 45, 50, 60].map(m => `<option value="${m}" ${CK.minutes === m ? 'selected' : ''}>${m} דקות</option>`).join('')}</select></label><label class="radio"><input type="radio" name="tcm" value="none" ${CK.mode === 'none' ? 'checked' : ''}> 🚫 בלי שעון</label></div>
   <p class="tnote tcnow">מוגדר עכשיו: <b>${clockLabel(CK)}</b></p><p class="tnote">קישור לכיתה עם ההגדרה הזו (כל מכשיר שייפתח ממנו יקבל אותה): <code class="tclink">${esc(clockLink(CK))}</code> <button type="button" class="btn small" data-a="copyclock">📋 העתקה</button></p></div>
  <h3>פתיחת מקום ישירות</h3><div class="row tbtns">${ROOMS.map(r => `<button class="btn" data-go="${r.id}">${r.icon} ${r.name}</button>`).join('')}<button class="btn" data-go="office">📚 הספרייה</button><button class="btn" data-go="hub">🗺️ המפה</button></div>
  <h3>התשובות</h3>${answersHTML()}`;
  node.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.go) { closeModal(); if (!$('#game').hidden) { b.dataset.go === 'hub' ? goHub() : go(b.dataset.go); } else enterGame(true, b.dataset.go); }
    if (b.dataset.a === 'print') printArea(`<div class="ansheet"><h1>חדר הבריחה בסוציולוגיה – דף תשובות למורה</h1><p>קוד מורה: ${TEACHER_CODE} · קוד הכספת: ${SAFE_CODE}</p>${answersHTML()}</div>`, 'p-ans');
    if (b.dataset.a === 'reset') { if (confirm('לאפס את כל ההתקדמות במכשיר הזה? (שם הקבוצה, הזמן, המילים והרמזים יימחקו)')) { localStorage.removeItem(KEY); S = fresh(); closeModal(); location.reload(); } }
    if (b.dataset.a === 'copyclock') { const t = node.querySelector('.tclink').textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('הקישור הועתק 📋')).catch(() => { const r = document.createRange(); r.selectNodeContents(node.querySelector('.tclink')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }); }
    if (b.dataset.a === 'exit') { exitTeacher(); closeModal(); }
  });
  node.addEventListener('change', e => { if (!e.target.closest('.tclock')) return; const m = node.querySelector('input[name=tcm]:checked').value; const c = { mode: m, minutes: +node.querySelector('.tcmins').value }; setClock(c); node.querySelector('.tcnow b').textContent = clockLabel(c); node.querySelector('.tclink').textContent = clockLink(c); });
  openModal({ title: '👩‍🏫 מצב מורה – כל התשובות', node, wide: true, cls: 'tcard' });
}
function updTeacherBadge() { const b = $('#tbadge'); if (b) b.hidden = true; const sb = $('#startTeacher'); if (sb) sb.textContent = TEACHER ? '👩‍🏫 פאנל מורה' : '👩‍🏫 כניסת מורה';
  document.body.classList.toggle('tmode', TEACHER); $$('.tstrip').forEach(x => x.hidden = !TEACHER); const tn = $('#tmNote'); if (tn) tn.hidden = !TEACHER; }
function exitTeacher() { const was = TEACHER; TEACHER = false; try { sessionStorage.removeItem('se_teacher'); } catch (e) { } updTeacherBadge(); if (was && !$('#game').hidden) { refreshMarkers(); renderPanel(); } }
function wireStrips() { $$('.tstrip').forEach(st => st.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.t === 'panel') teacherPanel(); if (b.dataset.t === 'exit') { exitTeacher(); closeModal(); toast('יצאת ממצב מורה'); } })); }
const CLOCK_KEY = 'soc_escape_clock';
function getClock() { try { const c = JSON.parse(localStorage.getItem(CLOCK_KEY)); if (c && ['stopwatch', 'countdown', 'none'].includes(c.mode)) return { mode: c.mode, minutes: +c.minutes || 45 }; } catch (e) { } return { mode: 'stopwatch', minutes: 45 }; }
function setClock(c) { try { localStorage.setItem(CLOCK_KEY, JSON.stringify(c)); } catch (e) { } }
(function clockFromURL() { try { const q = new URLSearchParams(location.search).get('clock'); if (!q) return; const m = /^(stopwatch|none|countdown)(\d+)?$/.exec(q); if (!m) return; setClock({ mode: m[1], minutes: m[1] === 'countdown' ? Math.min(120, Math.max(5, +m[2] || 45)) : 45 }); } catch (e) { } })();
function clockLabel(c) { return c.mode === 'countdown' ? `⏳ ספירה לאחור, ${c.minutes} דקות` : c.mode === 'none' ? '🚫 בלי שעון' : '⏱ שעון עצר'; }
function clockLink(c) { const u = new URL(location.href); u.search = ''; u.hash = ''; if (c.mode !== 'stopwatch') u.searchParams.set('clock', c.mode === 'countdown' ? 'countdown' + c.minutes : 'none'); return u.toString(); }

/* ======================= מסך פתיחה ======================= */
function deckle(n) { const pts = []; const j = () => (Math.random() * 3.5).toFixed(1) + 'px'; for (let i = 0; i <= n; i++) pts.push(`${(i / n * 100).toFixed(2)}% ${j()}`); for (let i = 1; i <= n; i++) pts.push(`calc(100% - ${j()}) ${(i / n * 100).toFixed(2)}%`); for (let i = n - 1; i >= 0; i--) pts.push(`${(i / n * 100).toFixed(2)}% calc(100% - ${j()})`); for (let i = n - 1; i > 0; i--) pts.push(`${j()} ${(i / n * 100).toFixed(2)}%`); return `polygon(${pts.join(',')})`; }
function startScreen() {
  const st = $('#start');
  const saved = S.started && !S.finishMs ? S : (S.finishMs ? S : null);
  const now = new Date(); const ds = now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hm = t => { const d = new Date(now - t * 60000); return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); };
  st.innerHTML = `<div class="nw" id="gzSheet">
   <header class="nw-top"><div class="nw-brand"><span class="nw-logo">ח</span><div><div class="nw-mast">${STORY.masthead}</div><div class="nw-tag">אתר החדשות של עיתון בית הספר</div></div></div><div class="nw-date">${ds}<span class="nw-live">● LIVE</span></div></header>
   <nav class="nw-nav" aria-hidden="true"><span class="on">ראשי</span><span>בית הספר</span><span>קהילה</span><span>תרבות</span><span>דעות</span><span>ספורט</span></nav>
   <div class="nw-tick"><b>מבזק</b><div class="nw-tickin"><span>המורה החדשה לסוציולוגיה לא הגיעה לשיעור הראשון · על הלוח נמצאה הודעה בכתב סתרים · כתבי העיתון שי ואלמה כבר בשטח · התלמידים מתבקשים לעזור בחיפוש</span></div></div>
   <main class="nw-main">
    <article class="nw-lead">
     <figure class="nw-fig"><img src="${M('img/trio.webp')}?v=2" alt="שי, המורה נוגה ואלמה"><figcaption>שי, המורה נוגה ואלמה ביום ההיכרות <span>צילום: מערכת העיתון</span></figcaption></figure>
     <div class="nw-lbody"><span class="nw-cat">בלעדי · בית הספר</span><h1 class="nw-head">${STORY.headline}</h1>
      <p class="nw-sub">קפה שעוד מעלה אדים, ספר פתוח, מעטפה סגורה – ואין זכר למורה נוגה. שי ואלמה מהמערכת יוצאים בעקבותיה, ואתם מוזמנים להצטרף.</p>
      <div class="nw-by"><span class="nw-av">ש</span>מאת שי ואלמה · עודכן ב-${hm(4)}</div>
      <button type="button" class="nw-jump" id="gzJump">להרשמה לצוות החיפוש ↓</button></div>
    </article>
    <div class="nw-cols">
     <article class="nw-card"><h3>${STORY.col1t}</h3><p>${STORY.col1}</p></article>
     <article class="nw-card"><h3>${STORY.col2t}</h3><p>${STORY.col2}</p></article>
     <aside class="nw-card nw-livebox"><h3><span class="nw-dot"></span>עדכונים שוטפים</h3><ul>
      <li><time>${hm(3)}</time>תלמידי השכבה כבר תלו שלטים: "איפה נוגה?"</li>
      <li><time>${hm(11)}</time>השרת מדווח: "ראיתי אותה עם מחברת קטנה ביד".</li>
      <li><time>${hm(19)}</time>מנהלת בית הספר: "אין סיבה לדאגה… כנראה".</li></ul></aside>
    </div>
    <div class="nw-low">
     <form class="nw-form" id="sform">
       <div class="nw-ftitle">🔎 הצטרפו לצוות החיפוש</div><div class="nw-fsub">כתבו את שם הקבוצה ויוצאים לדרך</div>
       <label class="nw-field">שם הקבוצה<input id="gname" maxlength="40" placeholder="למשל: הסוציולוגים מכיתה י'3" value="${esc(S.group)}" required></label>
       <div class="nw-btns">${saved && S.started ? `<button type="button" class="btn nw-btn primary" id="contBtn">▶ המשך המשחק של "${esc(S.group)}"</button><button type="submit" class="btn nw-btn">🆕 קבוצה חדשה</button>` : `<button type="submit" class="btn nw-btn primary">📰 יוצאים לחפש את נוגה!</button>`}</div>
       <div class="nw-fnote">⏱ הזמן נמדד משעת ההרשמה · כל רמז מוסיף דקה</div>
       <div class="gz-tmnote" id="tmNote" hidden>👩‍🏫 מצב מורה פעיל כרגע. כניסה כקבוצה יוצאת ממצב המורה, והמשחק יהיה רגיל, בלי תשובות.</div>
     </form>
     <aside class="nw-ads" aria-label="מודעות"><div class="nw-adlbl">פרסומות</div>
       <div class="nw-ad"><b>דרושים! 📣</b>כתבים צעירים וסקרנים לעיתון בית הספר<span>פנו לשי ולאלמה</span></div>
       <div class="nw-ad alt"><b>📓 מחברות תצפית</b>לסוציולוגים מתחילים: רואים הכול, רושמים הכול<span>בחנות הכתיבה בקניון</span></div>
       <div class="nw-ad"><b>אבד: חתול 🐈</b>ג'ינג'י וחברותי, עונה לשם "דורקהיים"<span>להחזיר לדלפק האבידות</span></div>
     </aside>
    </div>
   </main>
   <footer class="nw-foot"><button class="btn nw-teach" id="toGate" type="button">📜 הוראות</button><button class="btn nw-teach" id="startTeacher" type="button">👩‍🏫 כניסת מורה</button><span class="nw-note">מתאים למחשב ולטלפון · מותר להיעזר באינטרנט · יצרה: עינבל אריאלי</span><img class="gz-logo" src="img/logo.png" alt="INBAL ARIELY"></footer>
  </div>`;
  $('#gzJump').addEventListener('click', () => { $('#sform').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('#gname').focus({ preventScroll: true }), 500); });
  $('#sform').addEventListener('submit', e => { e.preventDefault(); const name = $('#gname').value.trim(); if (!name) { $('#gname').focus(); return; } exitTeacher();
    try { localStorage.removeItem(KEY); } catch (e) { } S = fresh(); S.group = name; S.timer = getClock(); S.started = Date.now(); save(); enterGame(); playClip('intro', [[0, 'יום ראשון ללימודים. המורה החדשה לסוציולוגיה… פשוט נעלמה.'], [3, 'שי ואלמה מעיתון בית הספר יוצאים בעקבותיה – ואתם איתם!'], [6, 'חמישה מקומות בעיר, חמש מילים, חמש ספרות – וכספת אחת 🔐']], null, 8.6); });
  const cb = $('#contBtn'); if (cb) cb.addEventListener('click', () => { exitTeacher(); enterGame(); });
  $('#toGate').addEventListener('click', () => showGate());
  $('#startTeacher').addEventListener('click', () => TEACHER ? teacherPanel() : teacherLogin());
  updTeacherBadge();
}
/* ======================= שער הוראות ======================= */
function showGate() { closeModal(); $('#game').hidden = true; $('#ending').hidden = true; $('#start').hidden = true; $('#gate').hidden = false; $('#gate').scrollTop = 0; updTeacherBadge(); }
function wireGate() {
  const d = $('#gtDust'); if (d && !d.childElementCount) { for (let i = 0; i < 34; i++) { const p = document.createElement('i'); const z = Math.random(); p.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;--s:${(2 + z * 5).toFixed(1)}px;--d:${(7 + Math.random() * 10).toFixed(1)}s;--dl:-${(Math.random() * 12).toFixed(1)}s;--x:${(Math.random() * 60 - 30).toFixed(0)}px;--c:${['#ffe08a', '#ffd23f', '#9ff3ff', '#ffb3e6', '#fff'][i % 5]}`; d.appendChild(p); } }
  $('#gateGo').addEventListener('click', () => { try { SND.init(); SND.sfx('click'); } catch (e) { } $('#gate').hidden = true; $('#start').hidden = false; startScreen(); window.scrollTo(0, 0); });
}
let inited = false;
function enterGame(teacherJump = false, where = null) {
  SND.init(); SND.startMusic();
  if (teacherJump && !S.started) { S.group = S.group || 'מורה'; S.started = Date.now(); save(); }
  $('#start').hidden = true; $('#gate').hidden = true; $('#game').hidden = false;
  drawTray(); tickTimer(); updTeacherBadge();
  if (!inited) { init3d(); inited = true; setTimeout(() => { if (CLIPS.finale) clipURL('finale'); else { const i = new Image(); i.src = M(IMGCLIP.finale) + '?v=2'; } }, 3500); }
  if (where && where !== 'hub') { showScene(where); renderPanel(); } else goHub();
  if (S.finishMs && !where) setTimeout(showEnding, 300);
}
/* ======================= חיבורים כלליים ======================= */
function wire() {
  wireClip();
  document.addEventListener('click', e => { if (e.detail > 0 && performance.now() - modalAt < 400 && $('#modal').contains(e.target)) { e.stopPropagation(); e.preventDefault(); } }, true);
  $('#mclose').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && performance.now() - modalAt > 600) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  const vol = $('#vol'), mute = $('#mute');
  vol.value = SND.getVolume(); const mi = () => { mute.textContent = SND.isMuted() || +vol.value === 0 ? '🔇' : '🔊'; mute.setAttribute('aria-pressed', SND.isMuted() ? 'true' : 'false'); }; mi();
  vol.addEventListener('input', () => { SND.init(); SND.setVolume(+vol.value); mi(); });
  mute.addEventListener('click', () => { SND.init(); SND.startMusic(); SND.setMuted(!SND.isMuted()); mi(); });
  $('#tbadge').addEventListener('click', teacherPanel); wireStrips();
  $('#homeBtn').addEventListener('click', () => { if (!$('#game').hidden) goHub(); });
  $('#menuBtn').addEventListener('click', () => { closeModal(); $('#game').hidden = true; $('#ending').hidden = true; $('#gate').hidden = true; $('#start').hidden = false; startScreen(); window.scrollTo(0, 0); });
}
document.fonts && document.fonts.load('700 40px Heebo').catch(() => { });
(document.fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]) : Promise.resolve()).then(() => { wire(); wireGate(); showGate(); window.__PE = { S: () => S, view: () => curView }; });
