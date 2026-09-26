// Petits effets sonores kawaii générés avec WebAudio (aucun fichier).
let ctx: AudioContext | null = null;
let enabled = true;

export const setSfxEnabled = (v: boolean) => {
  enabled = v;
};

function ac() {
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType = "sine",
  vol = 0.18,
) {
  const c = ac();
  if (!c || !enabled) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  tap: () => tone(880, 0, 0.08, "triangle", 0.1),
  good: () => {
    tone(784, 0, 0.15, "triangle");
    tone(1047, 0.1, 0.15, "triangle");
    tone(1319, 0.2, 0.25, "triangle");
  },
  bad: () => {
    tone(330, 0, 0.18, "square", 0.06);
    tone(262, 0.15, 0.25, "square", 0.06);
  },
  hit: () => {
    tone(1200, 0, 0.06, "sawtooth", 0.08);
    tone(600, 0.05, 0.15, "triangle", 0.12);
  },
  fuse: () => {
    [523, 659, 784, 1047].forEach((f, i) => {
      tone(f, i * 0.06, 0.2, "sine", 0.12);
    });
  },
  win: () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
      tone(f, i * 0.12, 0.3, "triangle", 0.14);
    });
  },
  flip: () => tone(660, 0, 0.07, "sine", 0.1),
};
