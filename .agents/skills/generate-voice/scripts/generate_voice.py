#!/usr/bin/env python3
"""Génère les répliques françaises du jeu avec des profils réutilisables Qwen3-TTS Base.

Réutilise l'installation ComfyUI locale (son venv fournit déjà torch + CUDA) et y ajoute, hors de
ComfyUI, une petite surcouche isolée (transformers 4.57.3 + qwen-tts) : le venv de ComfyUI n'est pas modifié.

Exemples :
  python generate_voice.py --list
  python generate_voice.py                                  # génère les lignes manquantes de voices.json
  python generate_voice.py --text "Bravo, bien joué !" --name cheer-bien-joue --speaker default
  python generate_voice.py --text "Bravo !" --name cheer-bravo --speaker default --variants 5
"""

from __future__ import annotations

import argparse
import configparser
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
MANIFEST = SKILL_DIR / "voices.json"
HOME = Path(os.environ.get("SH_VOICE_HOME") or Path.home() / ".cache" / "syllabic-hunters-voice")
OVERLAY = HOME / "overlay"
READY = OVERLAY / ".ready"
OVERLAY_VERSION = "1"
OVERLAY_PACKAGES = ["transformers==4.57.3", "huggingface_hub>=0.34,<1.0", "tokenizers>=0.22,<0.23"]
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign"
CLONE_MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"
VOICE_PROFILES = SKILL_DIR / "voice_profiles.json"

BASE_VOICE = (
    "Voix de jeune femme, locutrice native du français de Paris, accent français parisien "
    "authentique, sans aucun accent étranger ni anglais, prononciation française naturelle."
)
TONES = {
    "cheer": "Ton enthousiaste, chaleureux et fier, comme quand on félicite quelqu'un.",
    "praise": "Ton chaleureux, admiratif et posé, qui félicite un enfant d'avoir bien lu.",
    "encourage": (
        "Ton doux, bienveillant et encourageant, qui invite gentiment un enfant à réessayer, "
        "sans aucun reproche."
    ),
    "playful": "Ton espiègle et taquin, très expressif, avec un petit rire joyeux.",
    "calm": "Ton calme, clair et pédagogique, articulation soignée.",
}
DEFAULT_SEED = 3
GENDER_VARIANT_RE = re.compile(r"\[([^\]|]+)\|([^\]]+)\]")


def repo_root() -> Path:
    for p in [Path.cwd(), *Path.cwd().parents, *SKILL_DIR.parents]:
        if (p / "package.json").exists() and (p / "src").is_dir():
            return p
    return Path.cwd()


def comfy_python(workspace: Path) -> Path | None:
    for venv in (".venv", "venv"):
        for rel in ("Scripts/python.exe", "bin/python"):
            p = workspace / venv / rel
            if p.exists():
                return p
    return None


def find_comfy() -> Path:
    """Dossier de travail ComfyUI : $COMFYUI_PATH, sinon le workspace par défaut de comfy-cli."""
    candidates = [os.environ.get("COMFYUI_PATH")]
    for cfg in (
        Path(os.environ.get("LOCALAPPDATA", "")) / "comfy-cli" / "config.ini",
        Path.home() / ".config" / "comfy-cli" / "config.ini",
        Path.home() / "Library" / "Application Support" / "comfy-cli" / "config.ini",
    ):
        if cfg.is_file():
            cp = configparser.ConfigParser()
            cp.read(cfg, encoding="utf-8")
            candidates.append(cp.get("DEFAULT", "default_workspace", fallback=None))
    for c in candidates:
        if c and (Path(c) / "models").is_dir() and comfy_python(Path(c)):
            return Path(c)
    sys.exit("ComfyUI introuvable : définir COMFYUI_PATH (dossier contenant models/ et .venv/).")


def ensure_overlay(py: Path) -> None:
    """Installe transformers 4.x + qwen-tts dans un dossier isolé (le venv ComfyUI reste intact)."""
    if READY.exists() and READY.read_text().strip() == OVERLAY_VERSION:
        return
    print("Première utilisation : installation de la surcouche transformers 4.57.3 + qwen-tts...", flush=True)
    OVERLAY.mkdir(parents=True, exist_ok=True)
    # --no-deps : on ne veut que ces paquets (numpy, torch… viennent du venv ComfyUI, et un numpy plus récent casserait numba)
    pip = [str(py), "-m", "pip", "install", "--target", str(OVERLAY), "--upgrade", "--quiet", "--no-deps"]
    subprocess.run([*pip, *OVERLAY_PACKAGES, "qwen-tts"], check=True)
    READY.write_text(OVERLAY_VERSION)


def ensure_model(arg: str | None, comfy: Path, model_id: str = MODEL_ID) -> str:
    if arg:
        return arg
    target = comfy / "models" / "qwen-tts" / model_id.split("/")[1]
    if not (target / "config.json").exists():
        from huggingface_hub import snapshot_download

        print(f"Téléchargement du modèle {model_id} (~4 Go) vers {target}...", flush=True)
        snapshot_download(model_id, local_dir=str(target))
    return str(target)


def slugify(text: str) -> str:
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "voice"


def expand_gender_variants(job: dict) -> list[dict]:
    """Turn [masculine|feminine] markers into separately named voice jobs."""
    if not GENDER_VARIANT_RE.search(job["text"]):
        return [job]

    variants = []
    for gender, group in (("masculine", 1), ("feminine", 2)):
        variant = {**job, "name": f"{job['name']}-{gender}"}
        variant["text"] = GENDER_VARIANT_RE.sub(lambda match: match.group(group), job["text"])
        voice_texts = job.get("voice_texts", {})
        if gender in voice_texts:
            variant["voice_text"] = voice_texts[gender]
        role = job.get("speaker")
        variant["clone_profile"] = f"hero-{gender}" if role in (None, "default", "hero") else role
        variants.append(variant)
    return variants


def clone_profile_for(job: dict) -> str:
    """Choose one stable clone identity for a manifest entry."""
    if job.get("clone_profile"):
        return job["clone_profile"]
    speaker = job.get("speaker")
    if speaker and speaker != "default":
        return speaker
    voice_text = (job.get("voice_text") or "").lower()
    if "petite créature" in voice_text:
        return "mochi"
    if "masculine grave" in voice_text or "voix masculine grave" in voice_text:
        return "king"
    if "posée et légèrement grave" in voice_text:
        return "yuki"
    if "lumineuse, assurée" in voice_text:
        return "hana"
    if "enjouée, pétillante" in voice_text:
        return "mia"
    return speaker or "default"


def load_voice_profiles() -> dict:
    if not VOICE_PROFILES.exists():
        sys.exit(f"Profils vocaux absents : {VOICE_PROFILES}")
    return json.loads(VOICE_PROFILES.read_text(encoding="utf-8"))


def prepare_voice_references(comfy: Path, profiles: dict, torch, sf, model_cls) -> None:
    """Create any missing reusable reference clips with VoiceDesign."""
    missing = [key for key, profile in profiles.items() if not (SKILL_DIR / profile["reference_file"]).is_file()]
    if not missing:
        return
    model_path = ensure_model(None, comfy, MODEL_ID)
    print(f"Création de {len(missing)} références vocales avec VoiceDesign...", flush=True)
    model = model_cls.from_pretrained(
        model_path, device_map="cuda" if torch.cuda.is_available() else "cpu",
        dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
        attn_implementation="sdpa",
    )
    for key in missing:
        profile = profiles[key]
        instruct = f"{profile['voice_text']} {profile.get('tone_text', '')}".strip()
        torch.manual_seed(int(profile.get("seed", DEFAULT_SEED)))
        wavs, sr = model.generate_voice_design(
            text=profile["reference_text"], instruct=instruct, language="French",
            temperature=0.35, top_p=0.8, top_k=20,
        )
        path = SKILL_DIR / profile["reference_file"]
        path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(path, postprocess(wavs[0], sr), sr, subtype="PCM_16")
        print(f"Référence {key}: {path}", flush=True)
    del model
    import gc
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


def build_instruct(tone: str | None, tone_text: str | None, voice_text: str | None) -> str:
    tone_part = tone_text or TONES.get(tone or "cheer")
    if not tone_part:
        sys.exit(f"Ton inconnu : {tone}. Choix : {', '.join(TONES)} (ou --tone-text).")
    return f"{voice_text or BASE_VOICE} {tone_part}"


def postprocess(wav, sr):
    """Coupe les silences de début/fin et normalise le pic à -1 dBFS."""
    import numpy as np

    wav = np.asarray(wav, dtype="float32").squeeze()
    peak = float(np.abs(wav).max())
    if peak <= 0:
        return wav
    idx = np.where(np.abs(wav) > 0.01 * peak)[0]
    if not len(idx):
        return wav
    pad = int(0.04 * sr)
    wav = wav[max(idx[0] - pad, 0) : min(len(wav), idx[-1] + pad + 1)]
    return wav * (0.89 / peak)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--text", help="Réplique à synthétiser (sinon : lignes de voices.json)")
    ap.add_argument("--name", help="Nom du fichier sans extension (défaut : slug du texte)")
    ap.add_argument("--tone", help=f"Ton prédéfini : {', '.join(TONES)}")
    ap.add_argument("--tone-text", help="Description libre du ton (remplace --tone)")
    ap.add_argument("--voice-text", help="Description libre de la voix (remplace la voix de base)")
    ap.add_argument("--seed", type=int, help=f"Graine (défaut {DEFAULT_SEED}) ; change l'interprétation")
    ap.add_argument("--variants", type=int, default=0, help="N candidats (graines 1..N) écrits hors du dépôt")
    ap.add_argument("--temperature", type=float, default=0.35)
    ap.add_argument("--out-dir", help="Dossier de sortie (défaut : <repo>/assets/final/voice)")
    ap.add_argument("--only", help="Noms de voices.json à générer, séparés par des virgules")
    ap.add_argument("--force", action="store_true", help="Écrase les fichiers existants")
    ap.add_argument("--prune", action="store_true", help="Supprime après génération les WAV absents du catalogue complet")
    ap.add_argument("--engine", choices=("clone", "design"), default="clone", help="Clonage (défaut) ou conception directe")
    ap.add_argument("--model", help="Dossier local du modèle correspondant au moteur choisi")
    ap.add_argument("--prepare-references", action="store_true", help="Crée les références vocales manquantes puis quitte")
    ap.add_argument("--speaker", help="Profil vocal pour --text avec le moteur clone (défaut : default)")
    ap.add_argument("--list", action="store_true", help="Liste voices.json et les tons, puis quitte")
    args = ap.parse_args()

    if args.prune and (args.only or args.text or args.variants or args.prepare_references):
        sys.exit("--prune requiert le catalogue complet; ne pas le combiner avec --only, --text, --variants ou --prepare-references.")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else []
    out_dir = Path(args.out_dir) if args.out_dir else repo_root() / "assets" / "final" / "voice"

    if args.list:
        print("Tons :", ", ".join(TONES))
        for e in manifest:
            for job in expand_gender_variants(e):
                state = "ok     " if (out_dir / f"{job['name']}.wav").exists() else "MANQUE "
                print(f"  {state}{job['name']:<40}[{job.get('tone', 'cheer'):<9}] {job['text']}")
        return

    if args.prepare_references:
        jobs = []
    elif args.text:
        jobs = [{"name": args.name or slugify(args.text), "text": args.text, "speaker": args.speaker or "default"}]
    else:
        only = set(args.only.split(",")) if args.only else None
        selected = [e for e in manifest if not only or e["name"] in only]
        if only and len(selected) != len(only):
            sys.exit(f"Noms inconnus dans voices.json : {only - {e['name'] for e in selected}}")
        jobs = [job for entry in selected for job in expand_gender_variants(entry)]
    if args.text:
        jobs = [job for entry in jobs for job in expand_gender_variants(entry)]

    todo = []
    for j in jobs:
        if not args.variants and (out_dir / f"{j['name']}.wav").exists() and not args.force and not args.text:
            print(f"= {j['name']}.wav existe déjà (--force pour régénérer)")
        else:
            todo.append(j)
    if not todo and not args.prepare_references:
        print("Rien à générer.", flush=True)
        if args.prune:
            expected = {f"{job['name']}.wav" for job in jobs}
            removed = [path for path in out_dir.glob("*.wav") if path.name not in expected]
            for path in removed:
                path.unlink()
            print(f"Nettoyage terminé : {len(removed)} WAV obsolète(s) supprimé(s).", flush=True)
        return

    comfy = find_comfy()
    py = comfy_python(comfy)
    if os.environ.get("SH_VOICE_INNER") != "1":
        ensure_overlay(py)
        env = {
            **os.environ,
            "SH_VOICE_INNER": "1",
            "COMFYUI_PATH": str(comfy),
            "PYTHONPATH": str(OVERLAY),
            "PYTHONIOENCODING": "utf-8",
        }
        sys.exit(subprocess.run([str(py), str(Path(__file__).resolve()), *sys.argv[1:]], env=env).returncode)

    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.bfloat16 if device == "cuda" else torch.float32
    if args.prepare_references:
        prepare_voice_references(comfy, load_voice_profiles(), torch, sf, Qwen3TTSModel)
        print("Références vocales prêtes.", flush=True)
        return

    if args.engine == "design":
        source = ensure_model(args.model, comfy, MODEL_ID)
        print(f"Modèle : {source} ({device})", flush=True)
        model = Qwen3TTSModel.from_pretrained(source, device_map=device, dtype=dtype, attn_implementation="sdpa")
        for j in todo:
            instruct = build_instruct(
                args.tone or j.get("tone"), args.tone_text or j.get("tone_text"), args.voice_text or j.get("voice_text")
            )
            seeds = list(range(1, args.variants + 1)) if args.variants else [args.seed or j.get("seed") or DEFAULT_SEED]
            for seed in seeds:
                torch.manual_seed(seed)
                wavs, sr = model.generate_voice_design(
                    text=j.get("tts_text", j["text"]), instruct=instruct, language="French",
                    temperature=args.temperature, top_p=0.8, top_k=20,
                )
                wav = postprocess(wavs[0], sr)
                dest = (HOME / "candidates" / f"{j['name']}-s{seed}.wav") if args.variants else out_dir / f"{j['name']}.wav"
                dest.parent.mkdir(parents=True, exist_ok=True)
                sf.write(dest, wav, sr, subtype="PCM_16")
                print(f"OK {dest}  ({len(wav) / sr:.2f}s, seed {seed})", flush=True)
        return

    profiles = load_voice_profiles()
    prepare_voice_references(comfy, profiles, torch, sf, Qwen3TTSModel)
    source = ensure_model(args.model, comfy, CLONE_MODEL_ID)
    print(f"Modèle de clonage : {source} ({device})", flush=True)
    model = Qwen3TTSModel.from_pretrained(source, device_map=device, dtype=dtype, attn_implementation="sdpa")
    prompts = {}
    for key in {clone_profile_for(job) for job in todo}:
        if key not in profiles:
            sys.exit(f"Profil vocal inconnu : {key}. Compléter {VOICE_PROFILES}.")
        profile = profiles[key]
        reference = SKILL_DIR / profile["reference_file"]
        prompts[key] = model.create_voice_clone_prompt(ref_audio=str(reference), ref_text=profile["reference_text"])
    for j in todo:
        profile_key = clone_profile_for(j)
        seeds = list(range(1, args.variants + 1)) if args.variants else [args.seed or j.get("seed") or DEFAULT_SEED]
        for seed in seeds:
            torch.manual_seed(seed)
            wavs, sr = model.generate_voice_clone(
                text=j.get("tts_text", j["text"]), language="French", voice_clone_prompt=prompts[profile_key],
                temperature=args.temperature, top_p=0.8, top_k=20,
            )
            wav = postprocess(wavs[0], sr)
            dest = (HOME / "candidates" / f"{j['name']}-s{seed}.wav") if args.variants else out_dir / f"{j['name']}.wav"
            dest.parent.mkdir(parents=True, exist_ok=True)
            sf.write(dest, wav, sr, subtype="PCM_16")
            print(f"OK {dest}  ({len(wav) / sr:.2f}s, {profile_key}, seed {seed})", flush=True)

    if args.prune:
        expected = {f"{job['name']}.wav" for job in jobs}
        removed = [path for path in out_dir.glob("*.wav") if path.name not in expected]
        for path in removed:
            path.unlink()
        print(f"Nettoyage terminé : {len(removed)} WAV obsolète(s) supprimé(s).", flush=True)


if __name__ == "__main__":
    main()
