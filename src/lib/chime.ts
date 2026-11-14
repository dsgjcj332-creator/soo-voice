/**
 * Audio chimes for the guest-facing menu (/store) and order tracking.
 *
 * Three chime shapes:
 *   - 'cart':     short ascending 2-note (item added to cart) — discreet
 *   - 'preparing': 3-note ascending major triad (kitchen started) — bright
 *   - 'served':   4-note ascending fanfare (order served) — celebratory
 *
 * All are synthesized with the Web Audio API — no audio files needed,
 * works offline. The AudioContext is created lazily on first call and
 * shared across invocations.
 *
 * iOS autoplay policy: a user gesture (a tap on an "Add to order" button)
 * is required to unlock the AudioContext. The cart's first chime is
 * always triggered by a tap, which unlocks the context for subsequent
 * status-change chimes triggered by polling / realtime. We also call
 * `resume()` on every chime — a no-op if already running, and a
 * best-effort attempt if iOS suspended the context after the tab was
 * backgrounded.
 *
 * Haptic feedback is fired in parallel where supported.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    // iOS sometimes leaves the context in 'suspended' state (e.g.,
    // after the tab is backgrounded or the screen locked). We try to
    // resume it; this is a no-op if already 'running'.
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

interface Note {
  freq: number;
  start: number; // seconds offset from "now"
  duration: number; // seconds
  gain?: number;
  type?: OscillatorType;
}

function playNotes(notes: Note[]) {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = n.type || 'sine';
    osc.frequency.value = n.freq;
    const peak = n.gain ?? 0.18;
    const start = now + n.start;
    const end = start + n.duration;
    // Attack-decay envelope so each note feels discrete, not buzzy
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

export type ChimeType = 'cart' | 'preparing' | 'served';

export function playChime(type: ChimeType) {
  try {
    if (type === 'cart') {
      // Short ascending 2-note — discreet "added to cart"
      // 880Hz → 1320Hz (A5 → E6)
      playNotes([
        { freq: 880, start: 0, duration: 0.09 },
        { freq: 1320, start: 0.07, duration: 0.16 },
      ]);
    } else if (type === 'preparing') {
      // 3-note ascending major triad — "the kitchen started your order"
      // C5 → E5 → G5 — a bright, welcoming major chord rising up
      playNotes([
        { freq: 523.25, start: 0,    duration: 0.16 },
        { freq: 659.25, start: 0.10, duration: 0.16 },
        { freq: 783.99, start: 0.20, duration: 0.24, gain: 0.20 },
      ]);
    } else if (type === 'served') {
      // 4-note ascending fanfare — "your order is served"
      // E5 → G5 → B5 → E6 — a bright major arpeggio that resolves up
      // with a slightly louder final note for a "ta-da" feel.
      playNotes([
        { freq: 659.25,  start: 0,    duration: 0.14 },
        { freq: 783.99,  start: 0.10, duration: 0.14 },
        { freq: 987.77,  start: 0.20, duration: 0.14 },
        { freq: 1318.51, start: 0.30, duration: 0.36, gain: 0.24 },
      ]);
    }
  } catch {
    // AudioContext can fail before any user gesture; ignore silently.
  }
}

export function haptic(pattern: number | number[]) {
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {}
}
