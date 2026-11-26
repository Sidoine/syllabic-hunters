import { useEffect, useMemo, useRef, useState } from "react";
import { speak, stopSpeech } from "../lib/speech";
import { assetUrl } from "../lib/assets";
import {
	CARTOON_STAGES,
	INITIAL_CARTOON_SCENES,
	type CartoonAssetKind,
	type CartoonScene,
	type CartoonStageId,
	type ReviewStageId,
} from "../data/cartoonStudio";

const PROJECT_KEY = "syllabic-hunters-cartoon-studio-v1";
const PROJECT_MUSIC_KEY = "syllabic-hunters-cartoon-studio-music-v1";
const DB_NAME = "syllabic-hunters-cartoon-studio";
const DB_STORE = "assets";
const MUSIC_ASSET_KEY = "project:background-music";
const DEFAULT_MUSIC_PROMPT = "Musique instrumentale originale pour un conte animé peint à la main : ouverture féerique, chaleureuse et curieuse avec célesta, flûte douce et cordes pizzicato; une couleur mystérieuse apparaît lorsque le silence tombe; la fin retrouve une lumière tendre et pleine d'espoir. Mélodie simple et mémorable, arrangement léger qui reste discret sous la narration, transitions fluides, sans voix, sans paroles, sans bruitages, sans percussion forte.";
const REVIEW_STAGES: ReviewStageId[] = [
	"image-prompt",
	"image-review",
	"narration-text",
	"narration-audio",
	"motion-prompt",
	"clip-review",
];
const CHARACTER_REFERENCES = [
	{ id: "mochi", name: "Mochi", file: "mochi-peint-main.png", url: assetUrl("input/references/cartoon/mochi-peint-main.png") },
	{ id: "king", name: "Roi Chuuut", file: "king-chuuut-peint-main.png", url: assetUrl("input/references/cartoon/king-chuuut-peint-main.png") },
	{ id: "demon", name: "Démon", file: "demon-peint-main.png", url: assetUrl("input/references/cartoon/demon-peint-main.png") },
] as const;

function captionTrackUrl(text: string) {
	const safeText = text.trim().split("-->").join("→").split("\n").join(" ");
	return `data:text/vtt;charset=utf-8,${encodeURIComponent(`WEBVTT\n\n00:00:00.000 --> 00:00:15.000\n${safeText}\n`)}`;
}

function readAudioDuration(blob: Blob) {
	return new Promise<number>((resolve, reject) => {
		const audio = new Audio();
		const url = URL.createObjectURL(blob);
		const cleanUp = () => {
			URL.revokeObjectURL(url);
			audio.removeAttribute("src");
			audio.load();
		};
		audio.preload = "metadata";
		audio.onloadedmetadata = () => {
			const duration = audio.duration;
			cleanUp();
			if (Number.isFinite(duration)) resolve(duration);
			else reject(new Error("La durée de l'audio n'a pas pu être détectée."));
		};
		audio.onerror = () => {
			cleanUp();
			reject(new Error("La durée de l'audio n'a pas pu être détectée."));
		};
		audio.src = url;
	});
}

function readVideoDuration(blob: Blob) {
	return new Promise<number>((resolve, reject) => {
		const video = document.createElement("video");
		const url = URL.createObjectURL(blob);
		const cleanUp = () => {
			URL.revokeObjectURL(url);
			video.removeAttribute("src");
			video.load();
		};
		video.preload = "metadata";
		video.onloadedmetadata = () => {
			const duration = video.duration;
			cleanUp();
			if (Number.isFinite(duration)) resolve(duration);
			else reject(new Error("La durée de la vidéo n'a pas pu être détectée."));
		};
		video.onerror = () => {
			cleanUp();
			reject(new Error("La durée de la vidéo n'a pas pu être détectée."));
		};
		video.src = url;
	});
}

function clipDurationTarget(scene: CartoonScene) {
	if (!scene.narrationDurationSeconds || !Number.isFinite(scene.narrationDurationSeconds)) return undefined;
	return Math.min(15, Math.max(5, Math.ceil((scene.narrationDurationSeconds + 0.5) * 10) / 10));
}

function clipPromptWithDuration(scene: CartoonScene) {
	const duration = clipDurationTarget(scene);
	if (!duration) return scene.motionPrompt;
	const seconds = duration.toFixed(1);
	return `${scene.motionPrompt}\n\nDans ComfyUI, règle le paramètre « duration » à ${seconds} secondes. Durée cible : ${seconds} secondes, en un seul plan 16:9. Faire durer le mouvement jusqu'à la fin de la narration, puis maintenir une pose stable si nécessaire. Pas de coupe.`;
}

function formatDuration(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds - minutes * 60;
	return minutes > 0
		? `${minutes} min ${remainingSeconds.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`
		: `${seconds.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`;
}

function sceneReferences(scene: CartoonScene) {
	return CHARACTER_REFERENCES.filter((reference) => scene.imagePrompt.toLocaleLowerCase().includes(reference.name.toLocaleLowerCase()) ||
		(reference.id === "demon" && /démon/i.test(scene.imagePrompt)));
	}

function imagePromptWithReferences(scene: CartoonScene) {
	const references = sceneReferences(scene);
	if (references.length === 0) return scene.imagePrompt;
	const files = references.map((reference) => reference.file).join(", ");
	return `${scene.imagePrompt}\n\nRéférences personnages à joindre dans ImageGen : ${files}. Préserver fidèlement leur design et les rendre dans le style peint à la main demandé.`;
}

function freshScenes() {
	return INITIAL_CARTOON_SCENES.map((scene) => ({ ...scene, approved: {}, assets: { ...scene.assets } }));
}

function loadScenes(): CartoonScene[] {
	try {
		const saved: unknown = JSON.parse(localStorage.getItem(PROJECT_KEY) ?? "null");
		if (Array.isArray(saved)) {
			const savedScenes = new Map(saved.filter((item) => typeof item?.id === "string").map((item) => [item.id, item]));
			return INITIAL_CARTOON_SCENES.map((fallback) => {
				const item = savedScenes.get(fallback.id);
				if (!item) return { ...fallback, approved: {}, assets: {} };
				const needsCharacterCorrection = (fallback.id === "king-arrival-02" && /petites ailes|étoile dorée sur le ventre/i.test(item.imagePrompt)) ||
					(fallback.id === "king-arrival-04" && /cape sombre bordée de violet/i.test(item.imagePrompt));
				const needsSilenceExpansion = fallback.id === "king-arrival-05" && /se mit à enlever les syllabes et toutes les musiques/i.test(item.narration);
				const approved = { ...fallback.approved, ...(item.approved ?? {}) };
				if (needsCharacterCorrection || needsSilenceExpansion) for (const stage of REVIEW_STAGES) approved[stage] = false;
				return {
					...fallback,
					...item,
					imagePrompt: needsCharacterCorrection || needsSilenceExpansion ? fallback.imagePrompt : item.imagePrompt,
					narration: needsSilenceExpansion ? fallback.narration : item.narration,
					approved,
					assets: { ...fallback.assets, ...(item.assets ?? {}) },
				};
			});
		}
	} catch {
		// Une sauvegarde locale illisible repart des scènes de départ.
	}
	return freshScenes();
}

function loadMusicState() {
	try {
		const saved = JSON.parse(localStorage.getItem(PROJECT_MUSIC_KEY) ?? "null");
		return {
			prompt: typeof saved?.prompt === "string" ? saved.prompt : DEFAULT_MUSIC_PROMPT,
			assetName: typeof saved?.assetName === "string" ? saved.assetName : "",
			approved: saved?.approved === true,
		};
	} catch {
		return { prompt: DEFAULT_MUSIC_PROMPT, assetName: "", approved: false };
	}
}

function assetKey(sceneId: string, kind: CartoonAssetKind) {
	return `${sceneId}:${kind}`;
}

function openAssetDb() {
	return new Promise<IDBDatabase>((resolve, reject) => {
		if (!("indexedDB" in window)) {
			reject(new Error("Le stockage local des médias n'est pas disponible dans ce navigateur."));
			return;
		}
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("Impossible d'ouvrir le stockage des médias."));
	});
}

async function storeAsset(key: string, blob: Blob) {
	const db = await openAssetDb();
	try {
		await new Promise<void>((resolve, reject) => {
			const transaction = db.transaction(DB_STORE, "readwrite");
			transaction.objectStore(DB_STORE).put(blob, key);
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error ?? new Error("Impossible d'enregistrer ce média."));
			transaction.onabort = () => reject(transaction.error ?? new Error("Enregistrement annulé."));
		});
	} finally {
		db.close();
	}
}

async function readAsset(key: string) {
	const db = await openAssetDb();
	try {
		return await new Promise<Blob | undefined>((resolve, reject) => {
			const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(key);
			request.onsuccess = () => resolve(request.result as Blob | undefined);
			request.onerror = () => reject(request.error ?? new Error("Impossible de relire ce média."));
		});
	} finally {
		db.close();
	}
}

function waitForMetadata(media: HTMLMediaElement) {
	return new Promise<void>((resolve, reject) => {
		if (media.readyState >= 1) return resolve();
		media.onloadedmetadata = () => resolve();
		media.onerror = () => reject(new Error("Un média importé est illisible."));
		media.load();
	});
}

function playUntilEnd(media: HTMLMediaElement) {
	return new Promise<void>((resolve, reject) => {
		const finish = () => resolve();
		media.onended = finish;
		media.onerror = () => reject(new Error("La lecture d'un média a échoué."));
		void media.play().catch(() => reject(new Error("Le navigateur a bloqué la lecture d'un média.")));
	});
}

async function recordAssembly(items: { clipUrl: string; audioUrl: string; narration: string }[], backgroundMusicUrl: string) {
	if (!("MediaRecorder" in window) || !HTMLCanvasElement.prototype.captureStream) {
		throw new Error("L'assemblage vidéo n'est pas pris en charge par ce navigateur. Essaie avec Chrome ou Edge.");
	}
	const AudioContextClass = window.AudioContext;
	const audioContext = new AudioContextClass();
	const audioDestination = audioContext.createMediaStreamDestination();
	const canvas = document.createElement("canvas");
	canvas.width = 1280;
	canvas.height = 720;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Impossible de créer la piste vidéo.");
	let activeVideo: HTMLVideoElement | null = null;
	let frameId = 0;
	const draw = () => {
		try {
			context.fillStyle = "#17132b";
			context.fillRect(0, 0, canvas.width, canvas.height);
			if (activeVideo?.readyState && activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && activeVideo.videoWidth && activeVideo.videoHeight) {
				const scale = Math.min(canvas.width / activeVideo.videoWidth, canvas.height / activeVideo.videoHeight);
				const width = activeVideo.videoWidth * scale;
				const height = activeVideo.videoHeight * scale;
				try { context.drawImage(activeVideo, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height); }
				catch { /* Attendre la prochaine image décodable du clip. */ }
			}
		} finally {
			frameId = requestAnimationFrame(draw);
		}
	};
	const canvasStream = canvas.captureStream(24);
	const stream = new MediaStream([
		...canvasStream.getVideoTracks(),
		...audioDestination.stream.getAudioTracks(),
	]);
	const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
		.find((type) => MediaRecorder.isTypeSupported(type));
	const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
	let backgroundMusic: HTMLAudioElement | null = null;
	let backgroundMusicSource: MediaElementAudioSourceNode | null = null;
	const chunks: BlobPart[] = [];
	const captionCues: string[] = [];
	let captionTime = 0;
	const timestamp = (seconds: number) => {
		const milliseconds = Math.round(seconds * 1000);
		const hours = Math.floor(milliseconds / 3_600_000);
		const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
		const remainingSeconds = Math.floor((milliseconds % 60_000) / 1000);
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}.${String(milliseconds % 1000).padStart(3, "0")}`;
	};
	recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
	const stopped = new Promise<void>((resolve, reject) => {
		recorder.onstop = () => resolve();
		recorder.onerror = () => reject(new Error("L'enregistrement du montage a échoué."));
	});
	await audioContext.resume();
	try {
		backgroundMusic = new Audio(backgroundMusicUrl);
		backgroundMusic.loop = true;
		backgroundMusic.volume = 0.14;
		backgroundMusic.preload = "auto";
		await waitForMetadata(backgroundMusic);
		backgroundMusicSource = audioContext.createMediaElementSource(backgroundMusic);
		backgroundMusicSource.connect(audioDestination);
		recorder.start(250);
		frameId = requestAnimationFrame(draw);
		await backgroundMusic.play().catch(() => { throw new Error("La lecture de la musique d'ambiance a échoué."); });
		for (const item of items) {
			const video = document.createElement("video");
			video.src = item.clipUrl;
			video.muted = true;
			video.playsInline = true;
			video.preload = "auto";
			const audio = document.createElement("audio");
			audio.src = item.audioUrl;
			audio.preload = "auto";
			await Promise.all([waitForMetadata(video), waitForMetadata(audio)]);
			const duration = Math.max(video.duration, audio.duration);
			captionCues.push(`${captionCues.length + 1}\n${timestamp(captionTime)} --> ${timestamp(captionTime + duration)}\n${item.narration.split("-->").join("→").split("\n").join(" ")}\n`);
			captionTime += duration;
			const audioSource = audioContext.createMediaElementSource(audio);
			audioSource.connect(audioDestination);
			activeVideo = video;
			await Promise.all([playUntilEnd(video), playUntilEnd(audio)]);
			audioSource.disconnect();
			video.pause();
			audio.pause();
			video.removeAttribute("src");
			audio.removeAttribute("src");
			video.load();
			audio.load();
			video.remove();
			activeVideo = null;
		}
		recorder.stop();
		await stopped;
		backgroundMusic.pause();
		return {
			video: new Blob(chunks, { type: recorder.mimeType || "video/webm" }),
			captions: new Blob([`WEBVTT\n\n${captionCues.join("\n")}`], { type: "text/vtt" }),
		};
	} finally {
		backgroundMusic?.pause();
		backgroundMusicSource?.disconnect();
		backgroundMusic?.removeAttribute("src");
		backgroundMusic?.load();
		cancelAnimationFrame(frameId);
		canvasStream.getTracks().forEach((track) => { track.stop(); });
		stream.getTracks().forEach((track) => { track.stop(); });
		await audioContext.close();
	}
}

function firstUnapproved(scene: CartoonScene): CartoonStageId {
	return REVIEW_STAGES.find((stage) => !scene.approved[stage]) ?? "music-review";
}

function stageIndex(stage: CartoonStageId) {
	return CARTOON_STAGES.findIndex((item) => item.id === stage);
}


function canOpenStage(scene: CartoonScene, stage: CartoonStageId, canReviewMusic: boolean, musicApproved: boolean) {
	if (stage === "music-review") return canReviewMusic;
	if (stage === "assembly") return canReviewMusic && musicApproved;
	return stageIndex(stage) <= stageIndex(firstUnapproved(scene));
}

function hasStageInput(scene: CartoonScene, stage: ReviewStageId) {
	switch (stage) {
		case "image-prompt": return Boolean(scene.imagePrompt.trim());
		case "image-review": return Boolean(scene.assets.image);
		case "motion-prompt": return Boolean(scene.motionPrompt.trim());
		case "clip-review": return Boolean(scene.assets.clip);
		case "narration-text": return Boolean(scene.narration.trim());
		case "narration-audio": return Boolean(scene.assets.audio);
	}
}

function approvedCount(scene: CartoonScene) {
	return REVIEW_STAGES.filter((stage) => scene.approved[stage]).length;
}

export function CartoonStudio() {
	const [scenes, setScenes] = useState<CartoonScene[]>(loadScenes);
	const [activeSceneId, setActiveSceneId] = useState(scenes[0]?.id ?? INITIAL_CARTOON_SCENES[0].id);
	const [activeStage, setActiveStage] = useState<CartoonStageId>(() => firstUnapproved(scenes[0] ?? INITIAL_CARTOON_SCENES[0]));
	const [initialMusicState] = useState(loadMusicState);
	const [musicPrompt, setMusicPrompt] = useState(initialMusicState.prompt);
	const [musicAssetName, setMusicAssetName] = useState(initialMusicState.assetName);
	const [musicApproved, setMusicApproved] = useState(initialMusicState.approved);
	const [musicDurationSeconds, setMusicDurationSeconds] = useState<number>();
	const [backgroundMusicUrl, setBackgroundMusicUrl] = useState("");
	const [assets, setAssets] = useState<Record<string, string>>({});
	const [assemblyUrl, setAssemblyUrl] = useState("");
	const [assemblyCaptionUrl, setAssemblyCaptionUrl] = useState("");
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState("");
	const [storageWarning, setStorageWarning] = useState("");
	const urlRef = useRef<Record<string, string>>({});
	const backgroundMusicUrlRef = useRef("");
	const assemblyUrlRef = useRef("");
	const assemblyCaptionUrlRef = useRef("");
	const scene = scenes.find((item) => item.id === activeSceneId) ?? scenes[0];
	const selectedStage = CARTOON_STAGES[stageIndex(activeStage)];
	const currentAssetUrl = (kind: CartoonAssetKind) => scene ? (assets[assetKey(scene.id, kind)] ?? "") : "";
	const allScenesApproved = useMemo(
		() => scenes.every((item) => REVIEW_STAGES.every((stage) => item.approved[stage])),
		[scenes],
	);
	const totalDurationSeconds = useMemo(
		() => scenes.reduce((total, item) => total + Math.max(item.clipDurationSeconds ?? 0, item.narrationDurationSeconds ?? 0), 0),
		[scenes],
	);
	const canReviewMusic = allScenesApproved && scenes.every((item) =>
		Boolean(item.clipDurationSeconds && item.narrationDurationSeconds),
	);

	useEffect(() => {
		try { localStorage.setItem(PROJECT_KEY, JSON.stringify(scenes)); }
		catch { setStorageWarning("La sauvegarde des textes est indisponible dans ce navigateur."); }
	}, [scenes]);

	useEffect(() => {
		try { localStorage.setItem(PROJECT_MUSIC_KEY, JSON.stringify({ prompt: musicPrompt, assetName: musicAssetName, approved: musicApproved })); }
		catch { setStorageWarning("La sauvegarde de la musique est indisponible dans ce navigateur."); }
	}, [musicPrompt, musicAssetName, musicApproved]);

	useEffect(() => {
		let cancelled = false;
		if (musicAssetName) {
			void readAsset(MUSIC_ASSET_KEY).then(async (blob) => {
				if (!blob || cancelled) return;
				const url = URL.createObjectURL(blob);
				backgroundMusicUrlRef.current = url;
				setBackgroundMusicUrl(url);
				try {
					const duration = await readAudioDuration(blob);
					if (!cancelled) setMusicDurationSeconds(duration);
				} catch {
					if (!cancelled) setStorageWarning("La musique est chargée, mais sa durée n'a pas pu être détectée.");
				}
			}).catch(() => {
				if (!cancelled) setStorageWarning("La musique sauvegardée n'a pas pu être rouverte. Réimporte-la pour continuer.");
			});
		}
		return () => { cancelled = true; };
	}, [musicAssetName]);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			for (const item of scenes) {
				for (const kind of ["image", "clip", "audio"] as const) {
					const storedAsset = item.assets[kind];
					if (!storedAsset) continue;
					const key = assetKey(item.id, kind);
					if (urlRef.current[key]) continue;
					try {
						const blob = storedAsset.startsWith("/assets/work/cartoon-studio/")
							? await fetch(storedAsset).then((response) => {
								if (!response.ok) throw new Error("Image de storyboard introuvable.");
								return response.blob();
							})
							: await readAsset(key);
						if (!blob || cancelled) continue;
						const url = URL.createObjectURL(blob);
						urlRef.current[key] = url;
						setAssets((current) => ({ ...current, [key]: url }));
						if (kind === "audio") {
							try {
								const narrationDurationSeconds = await readAudioDuration(blob);
								if (!cancelled) setScenes((current) => current.map((scene) => scene.id === item.id && Math.abs((scene.narrationDurationSeconds ?? 0) - narrationDurationSeconds) > 0.05
									? { ...scene, narrationDurationSeconds }
									: scene));
							} catch {
								if (!cancelled) setStorageWarning("L'audio est importé, mais sa durée n'a pas pu être estimée.");
							}
						} else if (kind === "clip") {
							try {
								const clipDurationSeconds = await readVideoDuration(blob);
								if (!cancelled) setScenes((current) => current.map((scene) => scene.id === item.id && Math.abs((scene.clipDurationSeconds ?? 0) - clipDurationSeconds) > 0.05
									? { ...scene, clipDurationSeconds }
									: scene));
							} catch {
								if (!cancelled) setStorageWarning("Le clip est importé, mais sa durée n'a pas pu être estimée.");
							}
						}
					} catch {
						if (!cancelled) setStorageWarning("Un média sauvegardé n'a pas pu être rouvert. Réimporte-le pour continuer.");
					}
				}
			}
		})();
		return () => { cancelled = true; };
	}, [scenes]);

	useEffect(() => () => {
		stopSpeech();
		Object.values(urlRef.current).forEach((url) => { URL.revokeObjectURL(url); });
		if (backgroundMusicUrlRef.current) URL.revokeObjectURL(backgroundMusicUrlRef.current);
		if (assemblyUrlRef.current) URL.revokeObjectURL(assemblyUrlRef.current);
		if (assemblyCaptionUrlRef.current) URL.revokeObjectURL(assemblyCaptionUrlRef.current);
	}, []);

	const clearAssembly = () => {
		if (assemblyUrlRef.current) URL.revokeObjectURL(assemblyUrlRef.current);
		assemblyUrlRef.current = "";
		setAssemblyUrl("");
		if (assemblyCaptionUrlRef.current) URL.revokeObjectURL(assemblyCaptionUrlRef.current);
		assemblyCaptionUrlRef.current = "";
		setAssemblyCaptionUrl("");
	};

	const updateScene = (sceneId: string, resetFrom: ReviewStageId, update: (current: CartoonScene) => CartoonScene) => {
		clearAssembly();
		setMusicApproved(false);
		setScenes((current) => current.map((item) => {
			if (item.id !== sceneId) return item;
			const changed = update(item);
			const nextApproved = { ...changed.approved };
			for (const stage of REVIEW_STAGES.slice(REVIEW_STAGES.indexOf(resetFrom))) nextApproved[stage] = false;
			return { ...changed, approved: nextApproved };
		}));
	};

	const selectScene = (nextScene: CartoonScene) => {
		setActiveSceneId(nextScene.id);
		const nextStage = firstUnapproved(nextScene);
		setActiveStage(nextStage === "music-review" && !canReviewMusic ? "clip-review" : nextStage);
	};

	const selectStage = (next: CartoonStageId) => {
		if (!canOpenStage(scene, next, canReviewMusic, musicApproved)) return;
		setActiveStage(next);
	};

	const handleUpload = async (kind: CartoonAssetKind, file?: File) => {
		if (!file) return;
		const key = assetKey(scene.id, kind);
		try {
			await storeAsset(key, file);
			let narrationDurationSeconds: number | undefined;
			let clipDurationSeconds: number | undefined;
			if (kind === "audio") {
				try {
					narrationDurationSeconds = await readAudioDuration(file);
				} catch {
					setStorageWarning("L'audio est importé, mais sa durée n'a pas pu être estimée.");
				}
			} else if (kind === "clip") {
				try {
					clipDurationSeconds = await readVideoDuration(file);
				} catch {
					setStorageWarning("Le clip est importé, mais sa durée n'a pas pu être estimée.");
				}
			}
			const url = URL.createObjectURL(file);
			if (urlRef.current[key]) URL.revokeObjectURL(urlRef.current[key]);
			urlRef.current[key] = url;
			setAssets((current) => ({ ...current, [key]: url }));
			const stage: ReviewStageId = kind === "image" ? "image-review" : kind === "clip" ? "clip-review" : "narration-audio";
			updateScene(scene.id, stage, (current) => ({
				...current,
				assets: { ...current.assets, [kind]: file.name },
				...(kind === "audio" ? { narrationDurationSeconds } : {}),
				...(kind === "clip" ? { clipDurationSeconds } : {}),
			}));
			if ((kind !== "audio" || narrationDurationSeconds !== undefined) && (kind !== "clip" || clipDurationSeconds !== undefined)) setStorageWarning("");
		} catch (error) {
			setStorageWarning(error instanceof Error ? error.message : "Impossible d'enregistrer ce média.");
		}
	};

	const handleMusicUpload = async (file?: File) => {
		if (!file) return;
		try {
			await storeAsset(MUSIC_ASSET_KEY, file);
			const url = URL.createObjectURL(file);
			if (backgroundMusicUrlRef.current) URL.revokeObjectURL(backgroundMusicUrlRef.current);
			backgroundMusicUrlRef.current = url;
			setBackgroundMusicUrl(url);
			try {
				setMusicDurationSeconds(await readAudioDuration(file));
				setStorageWarning("");
			} catch {
				setMusicDurationSeconds(undefined);
				setStorageWarning("Le fichier est importé, mais sa durée audio n'a pas pu être détectée.");
			}
			setMusicAssetName(file.name);
			setMusicApproved(false);
			clearAssembly();
		} catch (error) {
			setStorageWarning(error instanceof Error ? error.message : "Impossible d'enregistrer la musique d'ambiance.");
		}
	};

	const updateMusicPrompt = (value: string) => {
		setMusicPrompt(value);
		setMusicApproved(false);
		clearAssembly();
	};

	const approveMusic = () => {
		if (!backgroundMusicUrl || !musicDurationSeconds || !canReviewMusic) return;
		setMusicApproved(true);
		setActiveStage("assembly");
	};

	const musicPromptWithDuration = () => {
		const duration = Math.round(totalDurationSeconds);
		return `${musicPrompt.trim()}\n\nDurée exacte demandée : ${duration} secondes (${formatDuration(totalDurationSeconds)}). Créer une piste instrumentale complète en une seule pièce, sans voix ni coupure finale. Dans ComfyUI ACE-Step, régler Seconds et Duration sur ${duration}.`;
	};

	const copyText = async (text: string, label: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setNotice(`${label} copié.`);
		} catch {
			setNotice("La copie automatique n'est pas disponible. Sélectionne le texte pour le copier.");
		}
		window.setTimeout(() => setNotice(""), 2600);
	};

	const approveStage = () => {
		if (activeStage === "assembly" || activeStage === "music-review" || !hasStageInput(scene, activeStage)) return;
		const stage = activeStage;
		const approvedScene = { ...scene, approved: { ...scene.approved, [stage]: true } };
		setScenes((current) => current.map((item) => item.id === scene.id ? approvedScene : item));
		setActiveStage(firstUnapproved(approvedScene));
	};

	const canAssemble = canReviewMusic && musicApproved && Boolean(backgroundMusicUrl) && scenes.every((item) =>
		Boolean(assets[assetKey(item.id, "clip")] && assets[assetKey(item.id, "audio")]),
	);

	const assemble = async () => {
		if (!canAssemble || busy) return;
		setBusy(true);
		setNotice("Assemblage en cours… lis les séquences qui s'affichent pour enregistrer le montage.");
		try {
			const result = await recordAssembly(scenes.map((item) => ({
				clipUrl: assets[assetKey(item.id, "clip")],
				audioUrl: assets[assetKey(item.id, "audio")],
				narration: item.narration,
			})), backgroundMusicUrl);
			clearAssembly();
			const url = URL.createObjectURL(result.video);
			assemblyUrlRef.current = url;
			setAssemblyUrl(url);
			const captionsUrl = URL.createObjectURL(result.captions);
			assemblyCaptionUrlRef.current = captionsUrl;
			setAssemblyCaptionUrl(captionsUrl);
			setNotice("Le montage est prêt à être relu et téléchargé.");
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Impossible d'assembler les séquences.");
		} finally {
			setBusy(false);
		}
	};

	const renderUpload = (kind: CartoonAssetKind, accepted: string, title: string, url: string) => {
		const storedAsset = scene.assets[kind];
		const assetDescription = storedAsset?.startsWith("/assets/work/cartoon-studio/")
			? `${kind === "image" ? "Image de storyboard" : kind === "clip" ? "Clip de la séquence" : "Audio du narrateur"} · ${storedAsset.split(".").pop()?.toUpperCase() ?? "MÉDIA"}`
			: storedAsset ?? `Formats : ${accepted.split(",").join(" · ")}`;
		return (
		<div className="space-y-4">
			{url && kind === "image" && <img src={url} alt={`Plan généré : ${scene.title}`} className="max-h-[min(50vh,34rem)] w-full rounded-2xl border border-white/15 bg-black/20 object-contain" />}
			{url && kind === "clip" && <video src={url} controls playsInline className="max-h-[min(50vh,34rem)] w-full rounded-2xl border border-white/15 bg-black/30"><track kind="captions" srcLang="fr" label="Français" src={captionTrackUrl(scene.narration)} default /></video>}
			{url && kind === "audio" && <audio src={url} controls className="w-full"><track kind="captions" srcLang="fr" label="Français" src={captionTrackUrl(scene.narration)} default /></audio>}
			<label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200/35 bg-white/[0.035] p-6 text-center transition hover:border-cyan-200/65 hover:bg-white/[0.07]">
				<span className="text-3xl">{kind === "image" ? "🖼️" : kind === "clip" ? "🎞️" : "🎙️"}</span>
				<span className="mt-2 font-bold text-white">{url ? "Remplacer le fichier" : title}</span>
				<span className="mt-1 text-sm text-white/55">{assetDescription}</span>
				<input className="sr-only" type="file" accept={accepted} onChange={(event) => { void handleUpload(kind, event.target.files?.[0]); event.target.value = ""; }} />
			</label>
		</div>
		);
	};

	if (!scene) return null;

	return (
		<div className="min-h-screen bg-[#100d20] text-white">
			<header className="border-b border-white/10 bg-[#17132b] px-4 py-4 sm:px-7">
				<div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-3">
						<div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-700 text-2xl shadow-lg">🎬</div>
						<div className="min-w-0">
							<p className="text-xs font-black uppercase tracking-[.2em] text-cyan-200">Atelier narratif · projet 01</p>
							<h1 className="truncate text-xl font-black sm:text-2xl">L'arrivée du Roi Chuuut</h1>
						</div>
					</div>
					<div className="hidden items-center gap-2 rounded-full border border-fuchsia-200/25 bg-fuchsia-300/10 px-4 py-2 text-xs font-bold text-fuchsia-100 sm:flex">
						<span className="h-2 w-2 rounded-full bg-fuchsia-300" />
						ComfyUI local · MiniMax H3
					</div>
					<a href="/" className="rounded-xl border border-white/15 px-3 py-2 text-sm font-bold text-white/75 transition hover:bg-white/10">Quitter le studio</a>
				</div>
			</header>

			<main className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 sm:px-7 lg:grid-cols-[270px_minmax(0,1fr)]">
				<aside className="space-y-4">
					<section className="rounded-3xl border border-white/10 bg-[#1a1730] p-4 shadow-xl">
						<div className="mb-3 flex items-center justify-between">
							<h2 className="font-black">Séquences</h2>
							<span className="text-xs font-bold text-white/45">{scenes.length} plans</span>
						</div>
						<div className="space-y-2">
							{scenes.map((item, index) => {
								const done = approvedCount(item) === REVIEW_STAGES.length;
								const active = item.id === scene.id;
								return <button key={item.id} type="button" onClick={() => selectScene(item)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-cyan-200/55 bg-cyan-300/10" : "border-white/8 bg-white/[.025] hover:bg-white/[.07]"}`}>
									<span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ${done ? "bg-emerald-400/20 text-emerald-200" : active ? "bg-cyan-300/20 text-cyan-100" : "bg-white/10 text-white/55"}`}>{done ? "✓" : String(index + 1).padStart(2, "0")}</span>
									<span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{item.title}</span><span className="mt-1 block text-[11px] text-white/45">{approvedCount(item)}/{REVIEW_STAGES.length} étapes validées</span></span>
								</button>;
							})}
						</div>
					</section>
					<section className="rounded-3xl border border-white/10 bg-[#1a1730] p-4">
						<p className="text-xs font-black uppercase tracking-widest text-violet-200">Le scénario</p>
						<p className="mt-2 text-sm leading-relaxed text-white/65">Mochi parle sans arrêt. Ses frères menacent d'appeler le Roi Chut. Le roi prend l'avertissement pour une invitation et dérobe les syllabes et la musique avec ses démons. Mochi part trouver un héros.</p>
					</section>
				</aside>

				<div className="min-w-0 space-y-4">
					<section className="rounded-3xl border border-white/10 bg-[#1a1730] p-4 sm:p-5">
						<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
							<div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">Étapes de fabrication</p><h2 className="mt-1 text-lg font-black sm:text-xl">{selectedStage.label}</h2></div>
							<p className="text-sm text-white/55">Séquence {scenes.findIndex((item) => item.id === scene.id) + 1} sur {scenes.length}</p>
						</div>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
							{CARTOON_STAGES.map((item) => {
								const locked = !canOpenStage(scene, item.id, canReviewMusic, musicApproved);
								const stageDone = item.id === "assembly" ? canAssemble : item.id === "music-review" ? musicApproved : scene.approved[item.id];
								return <button key={item.id} type="button" disabled={locked} onClick={() => selectStage(item.id)} className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${activeStage === item.id ? "border-violet-200/65 bg-violet-400/20" : "border-white/10 bg-white/[.025] hover:bg-white/[.07]"}`}>
									<span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${stageDone ? "bg-emerald-300/20 text-emerald-100" : "bg-white/10 text-white/60"}`}>{stageDone ? "✓" : item.short}</span>
									<span className="truncate text-[11px] font-bold sm:text-xs">{item.label}</span>
								</button>;
							})}
						</div>
					</section>

					{storageWarning && <p role="status" className="rounded-2xl border border-amber-200/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{storageWarning}</p>}
					{notice && <p role="status" className="rounded-2xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100">{notice}</p>}

					<section className="overflow-hidden rounded-3xl border border-white/10 bg-[#1a1730] shadow-2xl">
						<div className="border-b border-white/10 bg-gradient-to-r from-violet-500/10 via-transparent to-cyan-400/10 px-5 py-4 sm:px-7">
							<p className="text-xs font-black uppercase tracking-widest text-white/45">{selectedStage.description}</p>
							<h2 className="mt-1 text-2xl font-black">{activeStage === "music-review" || activeStage === "assembly" ? "L'arrivée du Roi Chuuut" : scene.title}</h2>
						</div>
						<div className="space-y-5 p-5 sm:p-7">
							{activeStage === "image-prompt" && <>
				<div className="rounded-2xl border border-violet-200/15 bg-violet-300/[.06] p-4 text-sm leading-relaxed text-white/70">Garde la même direction artistique d'une séquence à l'autre. Télécharge et joins les références pertinentes à ta requête ImageGen ; le prompt copié indique automatiquement quels personnages doivent rester fidèles à leur modèle.</div>
				<div className="grid grid-cols-3 gap-3">
					{sceneReferences(scene).map((reference) => <a key={reference.id} href={reference.url} download={reference.file} className="group rounded-xl border border-white/10 bg-[#100d20] p-2 transition hover:border-cyan-200/40"><img src={reference.url} alt={`Référence de ${reference.name}`} className="h-24 w-full rounded-lg object-contain sm:h-32" /><span className="mt-2 block truncate text-center text-xs font-bold text-white/75 group-hover:text-cyan-100">Télécharger · {reference.name}</span></a>)}
				</div>
								<label className="block"><span className="mb-2 block text-sm font-bold text-white/80">Description de l'image-clé</span><textarea value={scene.imagePrompt} onChange={(event) => updateScene(scene.id, "image-prompt", (current) => ({ ...current, imagePrompt: event.target.value }))} rows={9} className="w-full resize-y rounded-2xl border border-white/15 bg-[#100d20] p-4 text-sm leading-relaxed text-white outline-none transition focus:border-cyan-200/60" /></label>
				<div className="flex flex-wrap gap-3"><button type="button" onClick={() => void copyText(imagePromptWithReferences(scene), "Prompt ImageGen")} className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-2.5 text-sm font-black shadow-lg transition hover:brightness-110">Copier le prompt ImageGen</button><span className="self-center text-xs text-white/45">Génère l'image, puis importe-la à l'étape 2 pour la valider.</span></div>
							</>}

							{activeStage === "image-review" && <>
								<p className="text-sm leading-relaxed text-white/65">Compare l'image générée avec le prompt et les références des personnages. Valide le plan ou importe une nouvelle version.</p>
				<div className="grid grid-cols-3 gap-3">{sceneReferences(scene).map((reference) => <a key={reference.id} href={reference.url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-[#100d20] p-2"><img src={reference.url} alt={`Référence de ${reference.name}`} className="h-24 w-full rounded-lg object-contain sm:h-32" /><span className="mt-2 block truncate text-center text-xs font-bold text-white/70">{reference.name}</span></a>)}</div>
								{renderUpload("image", ".png,.jpg,.jpeg,.webp", "Importer l'image générée avec ImageGen", currentAssetUrl("image"))}
							</>}

							{activeStage === "motion-prompt" && <>
				<div className="rounded-2xl border border-fuchsia-200/20 bg-fuchsia-300/[.06] p-4"><p className="text-xs font-black uppercase tracking-widest text-fuchsia-100">Préparation du clip</p><p className="mt-1 text-sm text-white/65">Après validation du texte et de l'audio du narrateur, décris le mouvement du plan. La durée de l'audio est déjà connue pour préparer le clip dans ComfyUI · MiniMax H3.</p></div>
								<label className="block"><span className="mb-2 block text-sm font-bold text-white/80">Description du mouvement</span><textarea value={scene.motionPrompt} onChange={(event) => updateScene(scene.id, "motion-prompt", (current) => ({ ...current, motionPrompt: event.target.value }))} rows={7} className="w-full resize-y rounded-2xl border border-white/15 bg-[#100d20] p-4 text-sm leading-relaxed text-white outline-none transition focus:border-cyan-200/60" /></label>
								<p className="text-xs text-white/45">L'audio validé apparaîtra avant l'étape Clips. Sa durée sera ajoutée au prompt à copier pour ComfyUI.</p>
								<div className="flex flex-wrap gap-3"><button type="button" onClick={() => void copyText(scene.motionPrompt, "Description du mouvement")} className="rounded-xl bg-fuchsia-700 px-4 py-2.5 text-sm font-black shadow-lg transition hover:bg-fuchsia-600">Copier la description du mouvement</button><button type="button" onClick={() => void copyText(scene.imagePrompt, "Prompt image de référence")} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/75 hover:bg-white/10">Copier aussi le prompt image</button></div>
							</>}

							{activeStage === "clip-review" && <>
								<p className="text-sm leading-relaxed text-white/65">Relis le mouvement, la continuité du personnage et le cadrage. Chaque plan est validé séparément avant l'assemblage.</p>
								{scene.narrationDurationSeconds && <div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/[.06] p-4"><p className="text-xs font-black uppercase tracking-widest text-cyan-100">Durée de la narration</p><p className="mt-1 text-lg font-black">{formatDuration(scene.narrationDurationSeconds)}</p><p className="mt-1 text-sm text-white/65">Durée cible du clip : environ {formatDuration(clipDurationTarget(scene) ?? scene.narrationDurationSeconds)}. La consigne inclut une courte marge de fin.</p>{scene.narrationDurationSeconds > 14.5 && <p className="mt-2 text-sm font-bold text-amber-100">Cette narration dépasse la durée d'environ 15 secondes de MiniMax H3. Raccourcis-la ou divise la séquence avant de générer le clip.</p>}<button type="button" onClick={() => void copyText(clipPromptWithDuration(scene), "Prompt ComfyUI avec durée cible")} className="mt-3 rounded-xl bg-fuchsia-700 px-4 py-2.5 text-sm font-black shadow-lg transition hover:bg-fuchsia-600">Copier le prompt ComfyUI avec durée cible</button></div>}
								{renderUpload("clip", ".mp4,.webm,.mov", "Importer le clip généré dans ComfyUI", currentAssetUrl("clip"))}
							</>}

							{activeStage === "narration-text" && <>
								<label className="block"><span className="mb-2 block text-sm font-bold text-white/80">Texte du narrateur</span><textarea value={scene.narration} onChange={(event) => updateScene(scene.id, "narration-text", (current) => ({ ...current, narration: event.target.value }))} rows={5} className="w-full resize-y rounded-2xl border border-white/15 bg-[#100d20] p-4 text-base leading-relaxed text-white outline-none transition focus:border-cyan-200/60" /></label>
								<div className="flex flex-wrap gap-3"><button type="button" onClick={() => speak(scene.narration)} className="rounded-xl border border-cyan-100/25 bg-cyan-300/10 px-4 py-2.5 text-sm font-bold text-cyan-50 hover:bg-cyan-300/20">▶ Écouter le texte</button><button type="button" onClick={() => void copyText(scene.narration, "Texte du narrateur")} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/75 hover:bg-white/10">Copier le texte</button></div>
								<p className="text-xs text-white/45">Relis le texte à voix haute. Une fois validé, prépare l'audio final du narrateur et importe-le à l'étape suivante.</p>
							</>}

							{activeStage === "narration-audio" && <>
								<div className="rounded-2xl border border-white/10 bg-[#100d20] p-4"><p className="text-xs font-black uppercase tracking-widest text-white/45">Texte validé</p><p className="mt-2 text-sm leading-relaxed text-white/80">{scene.narration}</p></div>
								<p className="text-sm text-white/65">Génère et importe l'audio du narrateur maintenant. Le studio mesurera sa durée pour la transmettre au prompt du clip.</p>
								{renderUpload("audio", ".wav,.mp3,.m4a,.ogg,.webm", "Importer l'audio du narrateur", currentAssetUrl("audio"))}
								{scene.narrationDurationSeconds && <p className="text-sm font-bold text-cyan-100">Durée détectée : {formatDuration(scene.narrationDurationSeconds)}</p>}
							</>}

							{activeStage === "music-review" && <>
								<div className="rounded-2xl border border-fuchsia-200/20 bg-fuchsia-300/[.06] p-4"><p className="text-xs font-black uppercase tracking-widest text-fuchsia-100">Durée calculée sur les clips</p><p className="mt-1 text-2xl font-black">{formatDuration(totalDurationSeconds)}</p><p className="mt-1 text-sm text-white/65">La musique sera coupée avec la vidéo à la fin du dernier plan et mixée sous les neuf narrations.</p></div>
								<label className="block"><span className="mb-2 block text-sm font-bold text-white/80">Direction musicale</span><textarea value={musicPrompt} onChange={(event) => updateMusicPrompt(event.target.value)} rows={6} className="w-full resize-y rounded-2xl border border-white/15 bg-[#100d20] p-4 text-sm leading-relaxed text-white outline-none transition focus:border-cyan-200/60" /></label>
								<button type="button" onClick={() => void copyText(musicPromptWithDuration(), "Prompt de musique avec durée cible")} className="rounded-xl bg-fuchsia-700 px-4 py-2.5 text-sm font-black shadow-lg transition hover:bg-fuchsia-600">Copier le prompt ComfyUI ACE-Step</button>
								{backgroundMusicUrl && <div className="space-y-2 rounded-2xl border border-white/10 bg-[#100d20] p-4"><p className="text-sm font-bold text-white/80">Écouter la musique · {musicAssetName}</p><audio src={backgroundMusicUrl} controls preload="metadata" className="w-full"><track kind="captions" srcLang="fr" label="Français" src={captionTrackUrl("Musique instrumentale d’ambiance")}/></audio><p className="text-xs text-white/50">Durée générée : {musicDurationSeconds ? formatDuration(musicDurationSeconds) : "détection en cours"} · Durée du film : {formatDuration(totalDurationSeconds)}</p></div>}
								<label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-violet-200/35 bg-white/[0.035] p-6 text-center transition hover:border-cyan-200/65 hover:bg-white/[0.07]"><span className="text-3xl">🎼</span><span className="mt-2 font-bold text-white">{backgroundMusicUrl ? "Remplacer la musique" : "Importer la musique générée"}</span><span className="mt-1 text-sm text-white/55">{musicAssetName || "Formats : WAV · MP3 · M4A · OGG"}</span><input className="sr-only" type="file" accept=".wav,.mp3,.m4a,.ogg,.flac" onChange={(event) => { void handleMusicUpload(event.target.files?.[0]); event.target.value = ""; }} /></label>
								<button type="button" disabled={!backgroundMusicUrl || !musicDurationSeconds || !canReviewMusic} onClick={approveMusic} className="rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-5 py-3 font-black text-[#10212d] shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">Valider la musique et passer à l'assemblage →</button>
							</>}

							{activeStage === "assembly" && <>
								<div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-xs font-black uppercase tracking-widest text-white/45">Plans validés</p><p className="mt-2 text-2xl font-black">{scenes.filter((item) => approvedCount(item) === REVIEW_STAGES.length).length}/{scenes.length}</p></div><div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-xs font-black uppercase tracking-widest text-white/45">Durée cible</p><p className="mt-2 text-2xl font-black">{formatDuration(totalDurationSeconds)}</p></div><div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-xs font-black uppercase tracking-widest text-white/45">Sortie</p><p className="mt-2 text-2xl font-black">WebM · 720p</p></div></div>
								<div className="divide-y divide-white/10 rounded-2xl border border-white/10">
									{scenes.map((item, index) => <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-400/15 text-xs font-black text-violet-100">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.title}</span><span className="text-xs text-white/50">{item.assets.clip ?? "Clip manquant"} · {item.assets.audio ?? "Audio manquant"}</span><span className={approvedCount(item) === REVIEW_STAGES.length ? "text-xs font-bold text-emerald-200" : "text-xs font-bold text-amber-200"}>{approvedCount(item) === REVIEW_STAGES.length ? "Prêt" : `${approvedCount(item)}/${REVIEW_STAGES.length} validations`}</span></div>)}
									<div className="flex flex-wrap items-center gap-3 px-4 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-fuchsia-400/15 text-xs font-black text-fuchsia-100">♫</span><span className="min-w-0 flex-1 truncate text-sm font-bold">Musique d'ambiance</span><span className="text-xs text-white/50">{musicAssetName || "Piste non importée"} · mixée sous la narration</span><span className={musicApproved ? "text-xs font-bold text-emerald-200" : "text-xs font-bold text-amber-200"}>{musicApproved ? "Validée" : "À valider"}</span></div>
								</div>
								<button type="button" disabled={!canAssemble || busy} onClick={() => void assemble()} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 font-black text-[#0b231d] shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Assemblage en cours…" : "Assembler les séquences avec musique de fond"}</button>
								{!canAssemble && <p className="text-sm text-amber-100/75">Valide les six étapes de chaque séquence, puis la musique d'ambiance, pour activer l'assemblage.</p>}
								{assemblyUrl && <div className="space-y-3 rounded-2xl border border-emerald-200/20 bg-emerald-300/[.06] p-4"><video src={assemblyUrl} controls playsInline className="w-full rounded-xl bg-black"><track kind="captions" srcLang="fr" label="Français" src={assemblyCaptionUrl} default /></video><div className="flex flex-wrap gap-3"><a href={assemblyUrl} download="arrivee-du-roi-chuuut.webm" className="inline-flex rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-[#0b231d]">Télécharger le dessin animé</a><a href={assemblyCaptionUrl} download="arrivee-du-roi-chuuut.vtt" className="inline-flex rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/75">Télécharger les sous-titres</a></div></div>}
							</>}

							{activeStage !== "assembly" && activeStage !== "music-review" && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
								<p className="text-xs text-white/40">{scene.approved[activeStage] ? "Cette étape est validée. Toute modification la rouvrira ainsi que les étapes suivantes." : "La validation est requise pour passer à l'étape suivante."}</p>
								<button type="button" disabled={!hasStageInput(scene, activeStage)} onClick={approveStage} className="rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 px-5 py-3 font-black text-[#10212d] shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{scene.approved[activeStage] ? "Revalider et continuer" : "Valider cette séquence et continuer"} →</button>
							</div>}
						</div>
					</section>

					<div className="flex justify-between gap-3"><button type="button" disabled={scenes.findIndex((item) => item.id === scene.id) === 0} onClick={() => selectScene(scenes[Math.max(0, scenes.findIndex((item) => item.id === scene.id) - 1)])} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/65 hover:bg-white/10 disabled:opacity-30">← Séquence précédente</button><span className="self-center text-xs text-white/35">Les textes et validations sont sauvegardés automatiquement.</span><button type="button" disabled={scenes.findIndex((item) => item.id === scene.id) === scenes.length - 1} onClick={() => selectScene(scenes[Math.min(scenes.length - 1, scenes.findIndex((item) => item.id === scene.id) + 1)])} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold text-white/65 hover:bg-white/10 disabled:opacity-30">Séquence suivante →</button></div>
				</div>
			</main>
		</div>
	);
}

