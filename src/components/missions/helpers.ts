import type { Mission } from "../../data/story";
import { consonantOf, sayOf, VOWELS, vowelOf } from "../../data/syllables";
import {
	cleanPart,
	WORDS,
	type Word,
	wordsStartingWith,
	wordsWithSound,
	wordsWithWrittenSyllable,
} from "../../data/words";
import { sample, shuffle, uniq } from "../../lib/utils";

export interface MissionProps {
	mission: Mission;
	onDone: (errors: number, rounds: number) => void;
}

export const isVowel = (s: string) => VOWELS.some((v) => v.id === s);

/** Distracteurs proches : même consonne (voyelle différente) + même voyelle (consonne différente). */
export function confusables(
	target: string,
	pool: string[],
	n: number,
): string[] {
	const p = uniq(pool).filter((s) => s !== target);
	if (isVowel(target)) {
		// éviter o/ou ensemble trop souvent ? non : c'est justement une confusion à travailler
		return sample(p.filter(isVowel), n);
	}
	const c = consonantOf(target);
	const v = vowelOf(target);
	const sameC = shuffle(p.filter((s) => !isVowel(s) && consonantOf(s) === c));
	const sameV = shuffle(
		p.filter((s) => !isVowel(s) && vowelOf(s) === v && consonantOf(s) !== c),
	);
	const out: string[] = [];
	if (sameV.length && n >= 2) out.push(sameV[0]);
	for (const s of sameC) if (out.length < n) out.push(s);
	for (const s of sameV.slice(1)) if (out.length < n) out.push(s);
	for (const s of shuffle(p))
		if (out.length < n && !out.includes(s) && !isVowel(s)) out.push(s);
	return out.slice(0, n);
}

export const poolOf = (m: Mission) => uniq([...m.targets, ...m.review]);

export const consonantLabel = (c: string) => c.toUpperCase();
/** Nom des lettres pour la voix (C H -> « c, h ») */
export const consonantSpoken = (c: string) =>
	c === "ch" ? "c, h" : c.toUpperCase();

export const soundWords = (syl: string, startMode?: boolean) =>
	startMode ? wordsStartingWith(syl) : wordsWithSound(syl);

/** Mots d'entraînement qui contiennent (à l'oral) une des syllabes visées. */
export function wordsForTargets(targets: string[], maxParts = 4): Word[] {
	return WORDS.filter(
		(w) =>
			w.parts.length <= maxParts && w.sounds.some((s) => targets.includes(s)),
	);
}

/** Paires (mot, index de syllabe écrite) pour « le mot brisé » */
export function missingCandidates(
	targets: string[],
): { word: Word; index: number; syl: string }[] {
	const out: { word: Word; index: number; syl: string }[] = [];
	for (const t of targets) {
		for (const w of wordsWithWrittenSyllable(t)) {
			w.parts.forEach((p, i) => {
				if (p === t && w.sounds[i] === t)
					out.push({ word: w, index: i, syl: t });
			});
		}
	}
	return out;
}

export const wordSay = (w: Word) => w.say;
export const sylSay = (s: string) => sayOf(s);
export const partText = (p: string) => cleanPart(p);
