// מוזיקה ואפקטים שנוצרים בדפדפן (Web Audio) – בלי קבצי קול
let ctx = null, master, musicBus, sfxBus, timer = null, nextT = 0, step = 0;
let vol = parseFloat(localStorage.getItem('pe_vol') ?? '0.5');
let muted = localStorage.getItem('pe_mute') === '1';

export function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  apply();
}
function apply() { if (master) master.gain.setTargetAtTime(muted ? 0 : vol * 0.6, ctx.currentTime, 0.05); }
export function setVolume(v) { vol = v; localStorage.setItem('pe_vol', String(v)); if (v > 0 && muted) setMuted(false); apply(); }
export function setMuted(m) { muted = m; localStorage.setItem('pe_mute', m ? '1' : '0'); apply(); }
export const isMuted = () => muted;
export const getVolume = () => vol;

const N = n => 440 * Math.pow(2, (n - 69) / 12);
function tone(t, f, d, { type = 'triangle', g = 0.12, bus = musicBus, a = 0.01, cut = 0 } = {}) {
  const o = ctx.createOscillator(), e = ctx.createGain(); o.type = type; o.frequency.value = f;
  let last = o;
  if (cut) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cut; o.connect(fl); last = fl; }
  last.connect(e); e.connect(bus);
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.start(t); o.stop(t + d + 0.05);
}
// מוזיקת מסתורין ויקטוריאנית: לה מינור, ארפג'ו של "קופסת נגינה", בס רך ותקתוק שעון
const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [52, 56, 59], [57, 60, 64], [50, 53, 57], [52, 56, 59], [52, 56, 59]];
const MEL = [76, null, 72, 74, 76, null, 79, 77, 76, null, 74, 72, 71, null, 72, 74,  76, null, 72, 74, 77, null, 76, 74, 72, 71, 69, null, 71, null, 68, null];
const BEAT = 60 / 92 / 2; // שמיניות
function sched() {
  while (nextT < ctx.currentTime + 0.25) {
    const bar = Math.floor(step / 8) % CH.length, s8 = step % 8, ch = CH[bar];
    if (s8 === 0) { tone(nextT, N(ch[0] - 12), BEAT * 7.5, { type: 'sine', g: 0.16, a: 0.03 }); ch.forEach(n => tone(nextT, N(n), BEAT * 8, { type: 'sawtooth', g: 0.018, a: 0.4, cut: 900 })); }
    tone(nextT, N(ch[s8 % 3] + (s8 > 3 ? 12 : 0)), BEAT * 1.6, { type: 'triangle', g: 0.035 });
    const m = MEL[step % MEL.length]; if (m && (Math.floor(step / 32) % 2 === 1)) tone(nextT, N(m), BEAT * 1.8, { type: 'sine', g: 0.05, a: 0.02 });
    if (s8 % 2 === 0) tone(nextT, s8 % 4 === 0 ? 2200 : 1700, 0.04, { type: 'square', g: 0.008, cut: 3000 });
    nextT += BEAT; step++;
  }
}
export function startMusic() { init(); if (!ctx || timer) return; nextT = ctx.currentTime + 0.1; timer = setInterval(sched, 80); }

export function sfx(kind) {
  init(); if (!ctx) return; const t = ctx.currentTime + 0.01, b = sfxBus;
  const q = (f, d, o = {}) => tone(t + (o.at || 0), f, d, { bus: b, ...o });
  switch (kind) {
    case 'click': q(880, 0.08, { type: 'sine', g: 0.08 }); break;
    case 'clue': [72, 76, 79].forEach((n, i) => q(N(n), 0.35, { at: i * 0.07, type: 'triangle', g: 0.12 })); break;
    case 'wrong': q(N(52), 0.25, { type: 'triangle', g: 0.12 }); q(N(51), 0.35, { at: 0.12, type: 'triangle', g: 0.1 }); break;
    case 'ok': [67, 71, 74, 79].forEach((n, i) => q(N(n), 0.5, { at: i * 0.08, type: 'triangle', g: 0.13 })); break;
    case 'unlock': q(1200, 0.05, { type: 'square', g: 0.05, cut: 2500 }); q(700, 0.08, { at: 0.07, type: 'square', g: 0.06, cut: 2000 }); [72, 79, 84].forEach((n, i) => q(N(n), 0.6, { at: 0.18 + i * 0.1, g: 0.12 })); break;
    case 'win': [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => q(N(n), 0.9, { at: i * 0.09, g: 0.12 })); break;
    case 'tick': q(1500, 0.03, { type: 'square', g: 0.03, cut: 4000 }); break;
    case 'type': q(300 + Math.random() * 200, 0.04, { type: 'square', g: 0.03, cut: 1500 }); break;
  }
}
