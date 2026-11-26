import { useEffect, useRef, useState } from "react";
import { SPEECH_FALLBACK_EVENT, type SpeechFallbackNotice } from "../lib/speech";

export function SpeechFallbackToast() {
	const [notice, setNotice] = useState<SpeechFallbackNotice | null>(null);
	const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const onFallback = (event: Event) => {
			setNotice((event as CustomEvent<SpeechFallbackNotice>).detail);
			if (timeout.current) clearTimeout(timeout.current);
			timeout.current = setTimeout(() => setNotice(null), 10000);
		};
		window.addEventListener(SPEECH_FALLBACK_EVENT, onFallback);
		return () => {
			window.removeEventListener(SPEECH_FALLBACK_EVENT, onFallback);
			if (timeout.current) clearTimeout(timeout.current);
		};
	}, []);

	if (!notice) return null;
	return (
		<div
			role="alert"
			aria-live="assertive"
			className="fixed bottom-4 left-1/2 z-[300] w-[min(92vw,38rem)] -translate-x-1/2 rounded-2xl border-2 border-red-300 bg-red-950/95 p-4 text-white shadow-2xl"
		>
			<div className="font-black">Audio généré indisponible — voix du navigateur utilisée</div>
			<p className="mt-1 text-sm text-red-100">{notice.reason}</p>
			<p className="mt-1 truncate text-xs text-white/75">« {notice.text} »</p>
			{notice.file && <p className="mt-1 truncate text-xs text-white/55">{notice.file}</p>}
		</div>
	);
}
