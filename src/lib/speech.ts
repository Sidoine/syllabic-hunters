// Synthèse vocale française avec choix de voix et fallback.
let voices: SpeechSynthesisVoice[] = [];
let preferredURI: string | null = null;
let rate = 0.85;
let listeners: (() => void)[] = [];

const synth: SpeechSynthesis | null =
  typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null;

function loadVoices() {
  if (!synth) return;
  voices = synth
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith("fr"));
  listeners.forEach((l) => {
    l();
  });
}
if (synth) {
  loadVoices();
  synth.onvoiceschanged = loadVoices;
}

export const speechSupported = () => !!synth;
export const getFrenchVoices = () => voices;
export const onVoicesChanged = (fn: () => void) => {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
};

export function configureSpeech(opts: {
  voiceURI?: string | null;
  rate?: number;
}) {
  if (opts.voiceURI !== undefined) preferredURI = opts.voiceURI;
  if (opts.rate !== undefined) rate = opts.rate;
}

function pickVoice(): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI);
    if (v) return v;
  }
  const score = (v: SpeechSynthesisVoice) => {
    let s = 0;
    if (v.lang === "fr-FR") s += 10;
    if (/google/i.test(v.name)) s += 5;
    if (
      /(amélie|amelie|thomas|audrey|marie|denise|hortense|julie)/i.test(v.name)
    )
      s += 4;
    if (/natural|online|premium|enhanced/i.test(v.name)) s += 6;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

let speakToken = 0;
let seqToken = 0;

/** Parle (interrompt toute séquence en cours). */
export function speak(
  text: string,
  opts: { rate?: number; pitch?: number } = {},
) {
  seqToken++;
  return rawSpeak(text, opts);
}

/** Parle et résout quand c'est fini (ou après un délai de sécurité). */
function rawSpeak(
  text: string,
  opts: { rate?: number; pitch?: number } = {},
): Promise<void> {
  return new Promise((resolve) => {
    if (!synth || !text) return resolve();
    const token = ++speakToken;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = opts.rate ?? rate;
    u.pitch = opts.pitch ?? 1.1;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    setTimeout(finish, 1200 + text.length * 110);
    // petit délai : évite un bug de Chrome quand cancel() et speak() s'enchaînent
    setTimeout(() => {
      if (token === speakToken) synth.speak(u);
      else finish();
    }, 60);
  });
}

/** Dit plusieurs textes à la suite, avec une petite pause (annulable). */
export async function speakSeq(texts: string[], pause = 250) {
  const my = ++seqToken;
  for (const t of texts) {
    if (my !== seqToken) return;
    await rawSpeak(t);
    await new Promise((r) => setTimeout(r, pause));
  }
}

export function stopSpeech() {
  seqToken++;
  speakToken++;
  synth?.cancel();
}
