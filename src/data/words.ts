// Lexique illustré.
// Format : mot | emoji | syllabes écrites (séparées par "-", lettres muettes entre [ ])
//          | syllabes orales simples dans l'ordre ("_" = syllabe complexe non travaillée)
//          | texte à dire (optionnel)
// Les syllabes orales servent aux jeux « trouve le son » : on n'y indique une
// syllabe que si on l'entend vraiment (ex : « rose » -> ro,_ car le s se lit z).

export interface Word {
	word: string;
	emoji: string;
	parts: string[]; // syllabes écrites (avec [muet])
	sounds: string[]; // syllabes orales simples
	say: string;
}

const RAW = `
ananas|🍍|a-na-na[s]|a,na,_
avion|✈️|a-vion|a,_
abeille|🐝|a-beille|a,_
hibou|🦉|[h]i-bou|i,bou
île|🏝️|î-le|i
image|🖼️|i-ma-ge|i,ma,_
orange|🍊|o-ran-ge|o,_
olive|🫒|o-li-ve|o,li
oreille|👂|o-reille|o,_
usine|🏭|u-si-ne|u,_
univers|🌌|u-ni-ver[s]|u,ni,_
étoile|⭐|é-toi-le|é,_
éléphant|🐘|é-lé-phan[t]|é,lé,_
école|🏫|é-co-le|é,co
écureuil|🐿️|é-cu-reuil|é,cu,_
épée|⚔️|é-pée|é,pé
outil|🔧|ou-til|ou,_
ouragan|🌪️|ou-ra-gan|ou,ra,_
lama|🦙|la-ma|la,ma
lapin|🐰|la-pin|la,_
lit|🛏️|li[t]|li
loup|🐺|lou[p]|lou
locomotive|🚂|lo-co-mo-ti-ve|lo,co,mo,ti
lune|🌙|lu-ne|lu
lunettes|👓|lu-net-te[s]|lu,_
lutin|🧝|lu-tin|lu,_
lézard|🦎|lé-zar[d]|lé,_
loupe|🔍|lou-pe|lou
vélo|🚲|vé-lo|vé,lo
salade|🥗|sa-la-de|sa,la
ballon|⚽|bal-lon|ba,_
balai|🧹|ba-lai|ba,_
chocolat|🍫|cho-co-la[t]|cho,co,la
stylo|🖊️|sty-lo|_,lo
judo|🥋|ju-do|ju,do
dé|🎲|dé|dé
tulipe|🌷|tu-li-pe|tu,li
pilule|💊|pi-lu-le|pi,lu
poule|🐔|pou-le|pou
maman|👩|ma-man|ma,_
mamie|👵|ma-mie|ma,mi
micro|🎤|mi-cro|mi,_
miroir|🪞|mi-roir|mi,_
moto|🏍️|mo-to|mo,to
mouton|🐑|mou-ton|mou,_
mouche|🪰|mou-che|mou
moustique|🦟|mous-ti-que|mou,ti,_
musique|🎵|mu-si-que|mu,_
médaille|🏅|mé-dai-lle|mé,_
tomate|🍅|to-ma-te|to,ma
fromage|🧀|fro-ma-ge|_,ma
chameau|🐫|cha-meau|cha,mo
marteau|🔨|mar-teau|_,to
fourmi|🐜|four-mi|_,mi
caméra|🎥|ca-mé-ra|ca,mé,ra
midi|🕛|mi-di|mi,di
malade|🤒|ma-la-de|ma,la
rat|🐀|ra[t]|ra
radio|📻|ra-dio|ra,_
riz|🍚|ri[z]|ri
sourire|😊|sou-ri-re|sou,ri
souris|🐭|sou-ri[s]|sou,ri
robot|🤖|ro-bo[t]|ro,bo
robe|👗|ro-be|ro
rose|🌹|ro-se|ro,_
ruban|🎀|ru-ban|ru,_
tortue|🐢|tor-tue|_,tu
réveil|⏰|ré-veil|ré,_
roue|🛞|roue|rou
route|🛣️|rou-te|rou
carotte|🥕|ca-rot-te|ca,ro
girafe|🦒|gi-ra-fe|_,ra
parapluie|☂️|pa-ra-pluie|pa,ra,_
pirate|🏴‍☠️|pi-ra-te|pi,ra
numéro|🔢|nu-mé-ro|nu,mé,ro
zéro|0️⃣|zé-ro|_,ro
rhinocéros|🦏|[r]hi-no-cé-ro[s]|ri,no,sé,ro
sapin|🎄|sa-pin|sa,_
sirène|🧜‍♀️|si-rè-ne|si,_
scie|🪚|[s]cie|si
soleil|☀️|so-leil|so,_
sofa|🛋️|so-fa|so,fa
sucette|🍭|su-cet-te|su,_
sushi|🍣|su-shi|su,chi
seau|🪣|seau|so
soupe|🍲|sou-pe|sou
papa|👨|pa-pa|pa,pa
panda|🐼|pan-da|_,da
patate|🥔|pa-ta-te|pa,ta
papillon|🦋|pa-pil-lon|pa,pi,_
piano|🎹|pia-no|_,no
pile|🔋|pi-le|pi
pomme|🍎|pom-me|_
potiron|🎃|po-ti-ron|po,ti,_
poney|🐴|po-ney|po,_
punaise|📌|pu-nai-se|pu,_
poupée|🪆|pou-pée|pou,pé
poussin|🐥|pous-sin|pou,_
taxi|🚕|ta-xi|ta,_
tigre|🐯|ti-gre|ti,_
télé|📺|té-lé|té,lé
téléphone|☎️|té-lé-pho-ne|té,lé,fo
bateau|⛵|ba-teau|ba,to
gâteau|🎂|gâ-teau|ga,to
château|🏰|châ-teau|cha,to
cravate|👔|cra-va-te|_,va
pantalon|👖|pan-ta-lon|_,ta,_
banane|🍌|ba-na-ne|ba,na
nid|🪺|ni[d]|ni
nez|👃|ne[z]|né
nouille|🍜|nouil-le|nou
nounours|🧸|nou-nour[s]|nou,_
cinéma|🎬|ci-né-ma|_,né,ma
kimono|👘|ki-mo-no|_,mo,no
licorne|🦄|li-cor-ne|li,_
canard|🦆|ca-nar[d]|ca,_
dauphin|🐬|dau-phin|do,_
dinosaure|🦕|di-no-sau-re|di,no,_
douche|🚿|dou-che|dou
sandale|👡|san-da-le|_,da
bébé|👶|bé-bé|bé,bé
biberon|🍼|bi-be-ron|bi,_
bijou|💍|bi-jou|bi,jou
bisou|😘|bi-sou|bi,_
bougie|🕯️|bou-gie|bou,_
bouche|👄|bou-che|bou
baleine|🐋|ba-lei-ne|ba,_
cabane|🛖|ca-ba-ne|ca,ba
bouée|🛟|bou-ée|bou,é
famille|👨‍👩‍👧|fa-mil-le|fa,mi
fantôme|👻|fan-tô-me|_,to
fusée|🚀|fu-sée|fu,_
fumée|💨|fu-mée|fu,mé
foulard|🧣|fou-lar[d]|fou,_
fée|🧚|fée|fé
café|☕|ca-fé|ca,fé
photo|📷|pho-to|fo,to
filet|🥅|fi-le[t]|fi,_
vache|🐄|va-che|va
valise|🧳|va-li-se|va,li
virus|🦠|vi-rus|vi,_
voiture|🚗|voi-tu-re|_,tu
chat|🐱|cha[t]|cha
chapeau|🎩|cha-peau|cha,po
chaussure|👟|chau-ssu-re|cho,su
chou|🥬|chou|chou
jus|🧃|ju[s]|ju
cadeau|🎁|ca-deau|ca,do
cochon|🐷|co-chon|co,_
coco|🥥|co-co|co,co
couronne|👑|cou-ron-ne|cou,_
couteau|🔪|cou-teau|cou,to
gorille|🦍|go-ril-le|go,ri
goutte|💧|gou-tte|gou
kangourou|🦘|kan-gou-rou|_,gou,rou
escargot|🐌|es-car-go[t]|_,_,go
domino|🁫|do-mi-no|do,mi,no
jaguar|🐆|ja-guar|ja,_
juge|🧑‍⚖️|ju-ge|ju
jumeaux|👯|ju-meau[x]|ju,mo
joker|🃏|jo-ker|jo,_
vidéo|📼|vi-dé-o|vi,dé,o
vipère|🐍|vi-pè-re|vi,_
avocat|🥑|a-vo-ca[t]|a,vo,ca
bravo|👏|bra-vo|_,vo
livre|📖|li-vre|li,_
vampire|🧛|vam-pi-re|_,pi
chaussette|🧦|chau-sset-te|cho,_
parachute|🪂|pa-ra-chu-te|pa,ra,chu
échelle|🪜|é-chel-le|é,_
dodo|😴|do-do|do,do
`;

export const WORDS: Word[] = RAW.trim()
	.split("\n")
	.map((line) => {
		const [word, emoji, parts, sounds, say] = line.split("|");
		return {
			word,
			emoji,
			parts: parts.split("-"),
			sounds: sounds.split(","),
			say: say || word,
		};
	})
	// domino : emoji peu lisible, retiré des images
	.filter((w) => w.word !== "domino");

export const WORD_MAP: Record<string, Word> = Object.fromEntries(
	WORDS.map((w) => [w.word, w]),
);

/** Partie écrite sans crochets (ex: "cha[t]" -> "chat") */
export const cleanPart = (p: string) => p.replace(/[[\]]/g, "");

/** Mots où l'on entend la syllabe */
export const wordsWithSound = (syl: string) =>
	WORDS.filter((w) => w.sounds.includes(syl));

/** Mots qui commencent par le son */
export const wordsStartingWith = (syl: string) =>
	WORDS.filter((w) => w.sounds[0] === syl);

/** Mots contenant la syllabe écrite telle quelle (pour « le mot brisé ») */
export const wordsWithWrittenSyllable = (syl: string) =>
	WORDS.filter((w) => w.parts.some((p, i) => p === syl && w.sounds[i] === syl));
