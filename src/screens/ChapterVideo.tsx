import { useEffect, useRef, useState } from "react";
import { INITIAL_CARTOON_SCENES } from "../data/cartoonStudio";

const captionText = [
	"WEBVTT",
	"",
	...INITIAL_CARTOON_SCENES.flatMap((scene, index) => {
		const start = index * 10;
		const end = start + 10;
		const time = (seconds: number) => `00:00:${String(seconds).padStart(2, "0")}.000`;
		return [`${time(start)} --> ${time(end)}`, scene.narration, ""];
	}),
].join("\n");
const captionTrack = `data:text/vtt;charset=utf-8,${encodeURIComponent(captionText)}`;

export function ChapterVideo({ src, title, onEnd }: { src: string; title: string; onEnd: () => void }) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [playbackBlocked, setPlaybackBlocked] = useState(false);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		void video.play().then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true));
	}, []);

	return (
		<div className="fixed inset-0 z-[120] grid h-dvh w-screen place-items-center bg-black" role="dialog" aria-label={title}>
			<video
				ref={videoRef}
				src={src}
				autoPlay
				controls
				playsInline
				preload="auto"
				onEnded={onEnd}
				className="h-auto w-auto max-h-full max-w-full object-contain"
			><track kind="captions" srcLang="fr" label="Français" src={captionTrack} default /></video>
			{playbackBlocked && (
				<button
					type="button"
					onClick={() => {
						const playback = videoRef.current?.play();
						if (playback) void playback.then(() => setPlaybackBlocked(false)).catch(() => setPlaybackBlocked(true));
					}}
					className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600 px-8 py-4 text-xl font-black text-white shadow-xl"
				>
					Lire la vidéo ▶
				</button>
			)}
			<button
				type="button"
				onClick={onEnd}
				className="absolute right-4 top-4 rounded-full border border-white/30 bg-black/60 px-5 py-2.5 text-sm font-bold text-white backdrop-blur"
			>
				Passer la vidéo
			</button>
		</div>
	);
}
