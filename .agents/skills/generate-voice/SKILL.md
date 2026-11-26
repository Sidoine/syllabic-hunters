---
name: generate-voice
description: Génère et régénère les répliques vocales françaises du jeu avec des identités vocales réutilisables par clonage Qwen3-TTS. À utiliser pour ajouter une réplique, corriger une prononciation ou refaire les voix.
---

# generate-voice

Les voix du jeu sont générées avec **Qwen3-TTS 1.7B Base**, en clonant une référence audio propre à chaque personnage. Les références et leurs transcriptions sont définies dans [voice_profiles.json](voice_profiles.json) et stockées dans `assets/input/references/voice/`. Le générateur réutilise le même profil pour toutes les répliques d'un personnage. Les références manquantes sont créées avec **VoiceDesign**, puis les répliques sont synthétisées par **Base**.

Le catalogue [voices.json](voices.json) est généré depuis les dialogues de `src/data/` et les associations de sons du jeu. Après toute modification des dialogues ou des sons préenregistrés, le reconstruire avec `npm run voice:catalog`. Voice Review et ce skill utilisent ce même catalogue : il indique les textes, profils et fichiers attendus, y compris ceux qui restent à générer.

Le script `scripts/generate_voice.py` réutilise le venv de ComfyUI et une surcouche Python isolée (transformers 4.57.3 + `qwen-tts`). Il ne modifie pas le venv de ComfyUI. Les modèles sont conservés dans `<ComfyUI>/models/qwen-tts/`.

## Prérequis

- Une installation ComfyUI avec son `.venv`, repérée via `COMFYUI_PATH` ou le workspace de comfy-cli.
- Python et un GPU NVIDIA.
- Premier lancement : le script installe la surcouche dans `~/.cache/syllabic-hunters-voice/overlay` et télécharge les modèles VoiceDesign et Base (environ 4 Go chacun) s'ils manquent.

## Commandes

Depuis la racine du dépôt :

```powershell
# Voir les répliques présentes et manquantes
python .agents/skills/generate-voice/scripts/generate_voice.py --list

# Générer les répliques manquantes puis supprimer les WAV absents du catalogue
python .agents/skills/generate-voice/scripts/generate_voice.py --prune

# Créer les références de personnages manquantes
python .agents/skills/generate-voice/scripts/generate_voice.py --prepare-references

# Générer toutes les répliques manquantes par clonage
python .agents/skills/generate-voice/scripts/generate_voice.py

# Régénérer toute la bibliothèque
python .agents/skills/generate-voice/scripts/generate_voice.py --force

# Ajouter une réplique en réutilisant un profil existant
python .agents/skills/generate-voice/scripts/generate_voice.py --text "Bravo, bien joué !" --name cheer-bien-joue --speaker default

# Comparer trois prononciations avec la même identité vocale, hors du dépôt
python .agents/skills/generate-voice/scripts/generate_voice.py --text "Bravo !" --name cheer-bravo --speaker default --variants 3

# Créer directement une voix expérimentale sans clonage
python .agents/skills/generate-voice/scripts/generate_voice.py --engine design --text "Bonjour !" --name essai --voice-text "Voix féminine native du français de France."
```

Le moteur par défaut est `clone`. `--speaker` choisit un profil pour `--text`; les répliques du manifeste choisissent leur profil selon leur champ `speaker` ou leur description vocale. Les variantes gardent donc la même référence : elles permettent de comparer la prononciation et l'intonation sans créer une nouvelle identité.

Options : `--speaker`, `--only a,b`, `--force`, `--variants N`, `--seed N`, `--temperature` (0.35 par défaut en clonage), `--out-dir`, `--model`. `--engine design` sélectionne VoiceDesign, et `--voice-text` / `--tone-text` s'appliquent à ce moteur. Le clonage Base reprend l'identité et la couleur vocale de sa référence; il ne prend pas en charge ici une consigne d'intonation différente pour chaque phrase.

## Profils et voix genrées

`voice_profiles.json` relie un identifiant de profil à une référence audio et à sa transcription exacte. Ne remplace pas une référence validée sans écouter les nouveaux candidats. Les profils `default`, `hana`, `yuki`, `mia`, `mochi`, `king`, `hero-masculine` et `hero-feminine` ont chacun une identité stable.

Les textes peuvent contenir `[masculin|féminin]`. Le manifeste crée alors les deux fichiers suffixés `-masculine.wav` et `-feminine.wav` et assigne chaque variante à son profil vocal dédié. À la lecture, l'application choisit le fichier selon le genre explicite du personnage.

Pour une nouvelle réplique de scène, l’ajouter aux structures de dialogue dans `src/data/` ; le catalogue crée les fichiers attendus pour Voice Review et le générateur. Pour un son de jeu hors dialogue, ajouter son texte et son fichier à `RECORDED_LINES` dans `src/data/recordedVoiceLines.ts`, puis reconstruire le catalogue. Les répliques genrées du héros déclarent `who: "hero"` et produisent les deux profils.

## Qualité audio

- Écouter les références et un échantillon de chaque profil avant une régénération complète. L'accent demandé ne garantit pas une prononciation parfaite.
- Les textes courts, noms inventés et séries de syllabes sont à vérifier attentivement. Simplifier leur graphie ou la ponctuation si nécessaire.
- Le post-traitement coupe les silences de début et de fin en gardant 40 ms de marge, puis normalise le pic à −1 dBFS.
- Les sorties sont des WAV mono 24 kHz, 16 bits. Les variantes sont écrites dans `~/.cache/syllabic-hunters-voice/candidates`.

## Limites connues

- Le clonage stabilise le timbre, mais ne corrige pas les erreurs de prononciation de la référence ni celles produites sur un texte ambigu. Il faut vérifier les phrases pédagogiques à l'écoute.
- Qwen Base ne reçoit pas de consigne `instruct` par réplique dans cette API. L'émotion vient surtout de la référence, du texte et de sa ponctuation.
- Le node ComfyUI et `qwen-tts` ne fonctionnent pas avec transformers 5 dans l'environnement local. Garder la surcouche isolée et installer ses paquets avec `--no-deps` pour ne pas remplacer numpy/torch du venv.
