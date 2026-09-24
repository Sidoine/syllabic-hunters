// Syllabes simples (consonne + voyelle) du français, avec une stratégie
// de prononciation fiable pour la synthèse vocale : on fait lire à la voix
// un mot homophone (ex : "bo" -> "beau", "lou" -> "loup") plutôt que des
// lettres isolées que le navigateur épelle souvent ("b-o" -> "bé-o").
//
// Règles françaises prises en compte :
//  - Le "e" seul après une consonne (be, le, me...) est exclu : ce n'est pas
//    un son stable pour un débutant (e muet / « eu »). On utilise « é ».
//  - C et G sont durs uniquement devant a, o, u, ou (ca, co, cu, cou / ga, go, gou).
//    ci / ce se lisent « si / se » et gi / ge se lisent « ji / je » : exclus.
//  - « gu » est exclu (le u sert souvent juste à durcir le g : gui, gué).
//  - « ou » est traité comme une voyelle (deux lettres, un seul son).

export type VowelId = "a" | "i" | "o" | "u" | "é" | "ou";

export interface Vowel {
  id: VowelId;
  say: string;
  color: string;
  example: string; // mot exemple (clé du lexique)
}

export const VOWELS: Vowel[] = [
  { id: "a", say: "a", color: "#ff4fa3", example: "ananas" },
  { id: "i", say: "i", color: "#34c3ff", example: "hibou" },
  { id: "o", say: "oh", color: "#ff9a2e", example: "orange" },
  { id: "u", say: "u", color: "#7ddc4a", example: "usine" },
  { id: "é", say: "é", color: "#b36bff", example: "étoile" },
  { id: "ou", say: "où", color: "#ffd23f", example: "ouragan" },
];

export interface Consonant {
  id: string; // lettre(s) écrite(s)
  sound: string; // description du son pour les parents
  vowels: VowelId[];
}

export const CONSONANTS: Consonant[] = [
  { id: "l", sound: "llll", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "m", sound: "mmmm", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "r", sound: "rrrr", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "s", sound: "ssss", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "p", sound: "p", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "t", sound: "t", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "n", sound: "nnnn", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "d", sound: "d", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "b", sound: "b", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "f", sound: "ffff", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "v", sound: "vvvv", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "ch", sound: "chhhh", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "j", sound: "jjjj", vowels: ["a", "i", "o", "u", "é", "ou"] },
  { id: "c", sound: "k", vowels: ["a", "o", "u", "ou"] },
  { id: "g", sound: "gue", vowels: ["a", "o", "ou"] },
];

// Texte réellement envoyé à la synthèse vocale pour chaque syllabe.
export const SAY: Record<string, string> = {
  a: "a", i: "i", o: "oh", u: "u", "é": "é", ou: "où",
  la: "la", li: "lit", lo: "lot", lu: "lu", "lé": "les", lou: "loup",
  ma: "ma", mi: "mie", mo: "mot", mu: "mue", "mé": "mes", mou: "mou",
  ra: "rat", ri: "riz", ro: "rot", ru: "rue", "ré": "ré", rou: "roue",
  sa: "sa", si: "si", so: "seau", su: "su", "sé": "ses", sou: "sou",
  pa: "pas", pi: "pie", po: "pot", pu: "pu", "pé": "pé", pou: "pou",
  ta: "ta", ti: "ti", to: "tôt", tu: "tu", "té": "thé", tou: "tout",
  na: "na", ni: "nid", no: "nos", nu: "nu", "né": "né", nou: "nous",
  da: "da", di: "dit", do: "dos", du: "du", "dé": "dé", dou: "doux",
  ba: "bas", bi: "bi", bo: "beau", bu: "bu", "bé": "bé", bou: "bout",
  fa: "fa", fi: "fi", fo: "faux", fu: "fut", "fé": "fée", fou: "fou",
  va: "va", vi: "vie", vo: "veau", vu: "vu", "vé": "vé", vou: "vous",
  cha: "chat", chi: "chi", cho: "chaud", chu: "chu", "ché": "chez", chou: "chou",
  ja: "ja", ji: "j'y", jo: "jo", ju: "jus", "jé": "j'ai", jou: "joue",
  ca: "cas", co: "co", cu: "cu", cou: "cou",
  ga: "gars", go: "go", gou: "goût",
};

export function syllablesOf(consonantId: string): string[] {
  const c = CONSONANTS.find((x) => x.id === consonantId);
  if (!c) return [];
  return c.vowels.map((v) => c.id + v);
}

export function vowelOf(syl: string): VowelId {
  if (syl.endsWith("ou")) return "ou";
  return syl[syl.length - 1] as VowelId;
}

export function consonantOf(syl: string): string {
  return syl.slice(0, syl.length - vowelOf(syl).length);
}

export function vowelColor(v: VowelId): string {
  return VOWELS.find((x) => x.id === v)?.color ?? "#fff";
}

export const sayOf = (syl: string) => SAY[syl] ?? syl;
