---
name: generate-voice
description: Génère ou régénère les répliques vocales françaises du jeu (voix féminine, accent natif, ton expressif) en fichiers WAV avec Qwen3-TTS VoiceDesign. À utiliser pour créer une nouvelle réplique ("Bravo !", "Essaie encore !"…), changer le ton d'une voix, ou produire des candidats à comparer.
---

# generate-voice

Produit des WAV dans `src/assets/voice/` avec le modèle **Qwen3-TTS 1.7B VoiceDesign**. Le script `scripts/generate_voice.py` est autonome : il réutilise le **venv de ComfyUI** (torch + CUDA déjà installés) et ajoute, dans un dossier isolé, transformers 4.57.3 + `qwen-tts`. Le venv de ComfyUI n'est jamais modifié, et ComfyUI n'a pas besoin de tourner.

## Prérequis

- Une installation ComfyUI locale avec son `.venv`, trouvée via `COMFYUI_PATH` ou, à défaut, le workspace par défaut de comfy-cli (`%LOCALAPPDATA%\comfy-cli\config.ini`).
- N'importe quel `python` (le script n'utilise que la bibliothèque standard pour se relancer dans le venv ComfyUI).
- GPU NVIDIA (≈ 5–10 s par réplique après chargement du modèle).
- Premier lancement : installation de la surcouche dans `~/.cache/syllabic-hunters-voice/overlay` (changer avec `SH_VOICE_HOME`), puis téléchargement du modèle (~4 Go) dans `<ComfyUI>/models/qwen-tts/Qwen3-TTS-12Hz-1.7B-VoiceDesign` s'il est absent.

## Utilisation

Toutes les commandes se lancent depuis la racine du dépôt :

```powershell
# Voir les répliques du manifeste et celles qui manquent
python .github/skills/generate-voice/scripts/generate_voice.py --list

# Générer les répliques manquantes de voices.json (n'écrase rien sans --force)
python .github/skills/generate-voice/scripts/generate_voice.py

# Une nouvelle réplique
python .github/skills/generate-voice/scripts/generate_voice.py --text "Bravo, bien joué !" --name cheer-bien-joue --tone cheer

# 5 candidats (graines 1..5) à écouter, écrits hors du dépôt ; ne touche pas à src/
python .github/skills/generate-voice/scripts/generate_voice.py --text "Bravo !" --name cheer-bravo --tone cheer --variants 5
```

Options utiles : `--tone` (`cheer`, `praise`, `encourage`, `playful`, `calm`), `--tone-text "…"` (ton libre), `--voice-text "…"` (autre voix), `--seed N`, `--temperature` (0.7 par défaut, plus bas = prononciation plus stable), `--only a,b`, `--force`, `--out-dir`, `--model <dossier>`.

## Procédure pour ajouter une réplique au jeu

1. Ajouter l'entrée dans [voices.json](voices.json) : `{ "name": "cheer-xxx", "text": "…", "tone": "cheer" }` (`seed` optionnel).
2. Générer des candidats avec `--variants 5` et les écouter (chemins affichés, dans `~/.cache/syllabic-hunters-voice/candidates`). L'interprétation et l'accent varient fortement d'une graine à l'autre : toujours écouter.
3. Générer le fichier final : `--only cheer-xxx --seed <graine retenue>` (ou copier le candidat choisi dans `src/assets/voice/`). Noter la graine dans `voices.json`.
4. Enregistrer la réplique dans `RECORDED_LINES` de `src/lib/speech.ts` (clé = texte normalisé en minuscules avec apostrophe `'`, valeur = nom du fichier `.wav`). Sans cela, le jeu n'utilise pas le fichier et retombe sur la synthèse du navigateur.

## Conseils qualité

- La voix de base demande explicitement un **français natif de Paris, sans accent étranger ni anglais** : c'est ce qui réduit l'accent anglais constaté avec une consigne plus vague. Rédiger les consignes en français.
- Textes très courts (< 2 mots) : plus de variations, générer plusieurs candidats.
- Un fichier anormalement long (> 2× la durée attendue) contient souvent une pause ou un artefact : le rejeter.
- Les WAV sont débarrassés des silences de début/fin et normalisés à −1 dBFS (24 kHz, 16 bits, mono).

## Pièges connus

- Le node ComfyUI `qwen3-tts-comfyui` et `qwen-tts` ne fonctionnent pas avec transformers 5 (celui du venv ComfyUI actuel) : c'est pourquoi la surcouche isolée est nécessaire. Ne pas la remplacer par un `pip install` dans le venv ComfyUI.
- Dans la surcouche, tout est installé avec `--no-deps` : laisser pip résoudre les dépendances tire un numpy trop récent qui casse numba/librosa.
- Réinitialiser la surcouche : supprimer `~/.cache/syllabic-hunters-voice/overlay`.
