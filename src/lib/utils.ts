export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

export const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));

/** Répète/mélange une liste pour obtenir n éléments en évitant les doublons consécutifs */
export function cycle<T>(arr: T[], n: number): T[] {
  const out: T[] = [];
  while (out.length < n && arr.length) {
    const s = shuffle(arr);
    if (out.length && s[0] === out[out.length - 1] && s.length > 1) s.push(s.shift()!);
    out.push(...s);
  }
  return out.slice(0, n);
}

export const starsFor = (errors: number, rounds: number) => {
  if (errors === 0) return 3;
  if (errors <= Math.max(1, Math.floor(rounds / 3))) return 2;
  return 1;
};
