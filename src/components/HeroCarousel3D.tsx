import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { Save } from "../lib/storage";

export type HeroOption = { id: Save["hero"]; label: string; color: string };

export function HeroCarousel3D({
  heroes,
  selected,
  onSelect,
  compact = false,
}: {
  heroes: HeroOption[];
  selected: Save["hero"];
  onSelect: (hero: Save["hero"]) => void;
  compact?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const selectedOption = heroes.find((hero) => hero.id === selected) ?? heroes[0];
  const selectedIndex = heroes.findIndex((hero) => hero.id === selected);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 1.26, 8.1);
    camera.lookAt(0, 1.05, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe9f7ff, 0x37245f, 2.1));
    const keyLight = new THREE.DirectionalLight(0xfff2d2, 3.1);
    keyLight.position.set(-3.5, 6, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x79dfff, 2.3);
    fillLight.position.set(4, 3, 1);
    scene.add(fillLight);

    const stage = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 64),
      new THREE.MeshBasicMaterial({ color: 0x54d9f2, transparent: true, opacity: 0.24, depthWrite: false }),
    );
    stage.rotation.x = -Math.PI / 2;
    stage.position.y = 0.015;
    scene.add(stage);
    const stageRing = new THREE.Mesh(
      new THREE.RingGeometry(1.03, 1.12, 64),
      new THREE.MeshBasicMaterial({ color: 0xffdf69, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
    );
    stageRing.rotation.x = -Math.PI / 2;
    stageRing.position.y = 0.025;
    scene.add(stageRing);

    const carousel = new THREE.Group();
    scene.add(carousel);
    const modelGroups = new Map<Save["hero"], THREE.Group>();
    for (const hero of heroes) {
      const group = new THREE.Group();
      carousel.add(group);
      modelGroups.set(hero.id, group);
    }
    const state = { renderer, camera, heroes: modelGroups, frame: 0 };
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    for (const hero of heroes) {
      loader.load(
        hero.id === "zelane" ? "/models/heroes/hero-zelane-compressed.glb?v=map-assets-optimized-1" : `/models/heroes/hero-${hero.id}.glb?v=map-assets-optimized-1`,
        (gltf) => {
          const group = modelGroups.get(hero.id);
          if (!group) return;
          const bounds = new THREE.Box3().setFromObject(gltf.scene);
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          if (size.y > 0) {
            const model = gltf.scene;
            const scale = 2.35 / size.y;
            model.scale.setScalar(scale);
            model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
            model.traverse((object) => {
              if (object instanceof THREE.Mesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                for (const material of materials) {
                  if ("envMapIntensity" in material) material.envMapIntensity = 0.7;
                }
              }
            });
            group.add(model);
          }
          setLoaded((count) => count + 1);
        },
        undefined,
        () => {
          setFailed(true);
          setLoaded((count) => count + 1);
        },
      );
    }

    const resize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let lastTime = 0;
    const animate = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      const currentIndex = heroes.findIndex((hero) => hero.id === selectedRef.current);
      heroes.forEach((hero, index) => {
        const group = modelGroups.get(hero.id);
        if (!group) return;
        let offset = index - currentIndex;
        if (offset > heroes.length / 2) offset -= heroes.length;
        if (offset < -heroes.length / 2) offset += heroes.length;
        const angle = offset * (Math.PI * 0.29);
        const target = new THREE.Vector3(Math.sin(angle) * 2.05, 0, (Math.cos(angle) - 1) * 1.55);
        const scale = 1 - (1 - Math.cos(angle)) * 0.24;
        group.position.lerp(target, 1 - Math.exp(-delta * 7));
        const targetScale = new THREE.Vector3(scale, scale, scale);
        group.scale.lerp(targetScale, 1 - Math.exp(-delta * 7));
        const targetRotation = -angle * 0.45;
        group.rotation.y += (targetRotation - group.rotation.y) * (1 - Math.exp(-delta * 7));
        group.position.y = Math.sin(time * 0.0016 + index * 0.9) * 0.035;
      });
      stageRing.material.opacity = 0.74 + Math.sin(time * 0.002) * 0.18;
      renderer.render(scene, camera);
      state.frame = requestAnimationFrame(animate);
    };
    state.frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(state.frame);
      observer.disconnect();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [heroes]);

  const selectStep = (step: number) => {
    const next = (selectedIndex + step + heroes.length) % heroes.length;
    onSelect(heroes[next].id);
  };
  const pointerStart = useRef<number | null>(null);

  return (
    <div className="w-full">
      <div
        ref={mountRef}
        className={`relative w-full touch-pan-y ${compact ? "h-[150px] sm:h-[175px]" : "h-[280px] sm:h-[330px]"}`}
        onPointerDown={(event) => { pointerStart.current = event.clientX; }}
        onPointerUp={(event) => {
          if (pointerStart.current === null) return;
          const distance = event.clientX - pointerStart.current;
          pointerStart.current = null;
          if (Math.abs(distance) > 42) selectStep(distance < 0 ? 1 : -1);
        }}
        onPointerCancel={() => { pointerStart.current = null; }}
        aria-label="Carrousel 3D des personnages"
      >
        {loaded < heroes.length && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm font-bold text-cyan-100/80">Chargement des personnages…</div>}
        {failed && <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 text-center text-xs text-amber-100/80">Un modèle n’a pas pu être chargé.</div>}
      </div>
      <div className="flex items-center justify-center gap-5">
        <button type="button" aria-label="Personnage précédent" onClick={() => selectStep(-1)} className="btn-pop grid h-11 w-11 place-items-center rounded-full border-2 border-white/50 bg-slate-950/50 text-2xl font-black shadow-lg">‹</button>
        <div className="min-w-28 text-center">
          <div className="text-2xl font-black drop-shadow" style={{ color: selectedOption.color }}>{selectedOption.label}</div>
          <div className="mt-1 flex justify-center gap-1.5" aria-label={`${selectedIndex + 1} sur ${heroes.length}`}>
            {heroes.map((hero) => <span key={hero.id} className={`h-1.5 rounded-full transition-all ${hero.id === selected ? "w-5 bg-yellow-300" : "w-1.5 bg-white/45"}`} />)}
          </div>
        </div>
        <button type="button" aria-label="Personnage suivant" onClick={() => selectStep(1)} className="btn-pop grid h-11 w-11 place-items-center rounded-full border-2 border-white/50 bg-slate-950/50 text-2xl font-black shadow-lg">›</button>
      </div>
    </div>
  );
}
