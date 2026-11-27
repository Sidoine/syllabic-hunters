import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Speaker } from "../data/chapter";
import type { HeroId } from "../lib/storage";

const CHARACTER_MODELS: Record<Speaker | HeroId, string> = {
	hero_male: "/models/heroes/hero-milo.glb?v=characters-regenerated-2026-11-27",
	hero_female: "/models/heroes/hero-hana.glb?v=characters-regenerated-2026-11-27",
	yuki: "/models/dialogue/yuki.glb?v=characters-regenerated-2026-11-27",
	mochi: "/models/dialogue/mochi.glb?v=map-assets-optimized-1",
	demon: "/models/dialogue/demon.glb?v=demon-trellis-1",
	king: "/models/dialogue/king-chuuut.glb?v=map-assets-optimized-1",
	hana: "/models/heroes/hero-hana.glb?v=characters-regenerated-2026-11-27",
	luna: "/models/heroes/hero-luna.glb?v=characters-regenerated-2026-11-27",
	mia: "/models/heroes/hero-mia.glb?v=characters-regenerated-2026-11-27",
	milo: "/models/heroes/hero-milo.glb?v=characters-regenerated-2026-11-27",
	zelane: "/models/heroes/hero-zelane-compressed.glb?v=characters-regenerated-2026-11-27",
};

export function DialogueCharacter3D({
	character,
	label,
	className,
}: {
	character: Speaker | HeroId;
	label: string;
	className?: string;
}) {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		let disposed = false;
		let frame = 0;
		let model: THREE.Group | null = null;
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
		camera.position.set(0, 1.08, 4.65);
		camera.lookAt(0, 1.08, 0);
		const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setClearColor(0x000000, 0);
		renderer.domElement.setAttribute("role", "img");
		renderer.domElement.setAttribute("aria-label", label);
		renderer.domElement.style.display = "block";
		renderer.domElement.style.height = "100%";
		renderer.domElement.style.width = "100%";
		host.appendChild(renderer.domElement);

		scene.add(new THREE.HemisphereLight(0xfff2ff, 0x38205c, 2.1));
		const keyLight = new THREE.DirectionalLight(0xffe4ff, 3.2);
		keyLight.position.set(-3, 5, 5);
		scene.add(keyLight);
		const fillLight = new THREE.DirectionalLight(0x7fe9ff, 1.6);
		fillLight.position.set(4, 2, -3);
		scene.add(fillLight);

		const resize = () => {
			const { width, height } = host.getBoundingClientRect();
			if (!width || !height) return;
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			renderer.setSize(width, height, false);
		};
		const observer = new ResizeObserver(resize);
		observer.observe(host);
		resize();

		const loader = new GLTFLoader();
		loader.load(CHARACTER_MODELS[character], (gltf) => {
			if (disposed) return;
			model = gltf.scene;
			const bounds = new THREE.Box3().setFromObject(model);
			const size = bounds.getSize(new THREE.Vector3());
			const center = bounds.getCenter(new THREE.Vector3());
			if (size.y > 0) {
				const scale = 2.25 / size.y;
				model.scale.setScalar(scale);
				model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
				model.rotation.y = -Math.PI / 2;
				scene.add(model);
			}
		}, undefined, (error) => {
			console.error(`Impossible de charger le modèle 3D de ${label}.`, error);
		});

		const render = () => {
			if (disposed) return;
			if (model) model.rotation.y = -Math.PI / 2 + Math.sin(performance.now() / 1800) * 0.12;
			renderer.render(scene, camera);
			frame = requestAnimationFrame(render);
		};
		render();

		return () => {
			disposed = true;
			cancelAnimationFrame(frame);
			observer.disconnect();
			scene.traverse((object) => {
				if (!(object instanceof THREE.Mesh)) return;
				object.geometry.dispose();
				for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
					for (const value of Object.values(material)) {
						if (value instanceof THREE.Texture) value.dispose();
					}
					material.dispose();
				}
			});
			renderer.dispose();
			renderer.domElement.remove();
		};
	}, [character, label]);

	return <div ref={hostRef} className={`relative shrink-0 overflow-hidden rounded-3xl ${className ?? ""}`} />;
}
