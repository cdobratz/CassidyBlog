import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Grass } from "./Grass.jsx";
import { RING, SITUATIONS } from "./props.js";

const RADIUS = RING;
const GEOMETRY = {
  box: "boxGeometry",
  cyl: "cylinderGeometry",
  sph: "sphereGeometry",
  cone: "coneGeometry",
  tor: "torusGeometry",
  oct: "octahedronGeometry",
  plane: "planeGeometry",
};

function gradientMap() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  const image = context.createImageData(4, 1);
  [70, 130, 185, 255].forEach((shade, index) => {
    image.data[index * 4] = shade;
    image.data[index * 4 + 1] = shade;
    image.data[index * 4 + 2] = shade;
    image.data[index * 4 + 3] = 255;
  });
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function Part({ part, material }) {
  const Tag = GEOMETRY[part.g] || "boxGeometry";
  return (
    <mesh position={part.p} rotation={part.r || [0, 0, 0]} scale={part.s} material={material}>
      <Tag args={part.a} />
    </mesh>
  );
}

function Rain() {
  const group = useRef(null);
  const drops = useMemo(
    () =>
      Array.from({ length: 9 }, (_, index) => ({
        x: (Math.sin(index * 2.1) - 0.15) * 0.7,
        z: (Math.cos(index * 1.7) - 0.2) * 0.35,
        speed: 0.45 + (index % 4) * 0.12,
        offset: index * 0.17,
      })),
    []
  );
  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }
    const time = clock.elapsedTime;
    group.current.children.forEach((drop, index) => {
      const cycle = (time * drops[index].speed + drops[index].offset) % 1;
      drop.position.y = 1.35 - cycle * 1.25;
    });
  });
  return (
    <group ref={group}>
      {drops.map((drop, index) => (
        <mesh key={index} position={[drop.x, 1, drop.z]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color="#9bb7c9" transparent opacity={0.75} />
        </mesh>
      ))}
    </group>
  );
}

function Situation({ spec, index, materials }) {
  const group = useRef(null);
  const angle = (index / SITUATIONS.length) * Math.PI * 2;
  useFrame(({ clock }) => {
    if (!group.current) {
      return;
    }
    const hover = spec.float ? Math.sin(clock.elapsedTime * 0.9 + index) * 0.06 : 0;
    const bob = Math.sin(clock.elapsedTime * 0.7 + angle) * 0.02;
    group.current.position.y = (spec.float || 0) + hover + bob;
  });
  return (
    <group
      ref={group}
      position={[Math.cos(angle) * RADIUS, spec.float || 0, Math.sin(angle) * RADIUS]}
      rotation={[0, Math.PI / 2 - angle, 0]}
      scale={1.7}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.85, 20]} />
        <meshBasicMaterial color="#1c2418" transparent opacity={0.14} />
      </mesh>
      {spec.parts.map((part, partIndex) => (
        <Part key={partIndex} part={part} material={materials(part)} />
      ))}
      {spec.rain ? <Rain /> : null}
    </group>
  );
}

function Rig({ yaw, night }) {
  const ambient = useRef(null);
  const sun = useRef(null);
  const shown = useRef(0);
  const label = useRef("");
  useFrame((_, delta) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let gap = yaw.current - shown.current;
    if (gap > 0.5) {
      gap -= 1;
    }
    if (gap < -0.5) {
      gap += 1;
    }
    shown.current = reduced ? yaw.current : (shown.current + gap * Math.min(1, delta * 5) + 1) % 1;
    const angle = shown.current * Math.PI * 2;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const focus = direction.clone().multiplyScalar(RADIUS);
    const camera = _.camera;
    camera.position.copy(focus).addScaledVector(direction, 9.4);
    camera.position.y = 1.7;
    camera.lookAt(focus.x, 2.35, focus.z);
    if (ambient.current) {
      ambient.current.intensity = night ? 0.34 : 0.72;
    }
    if (sun.current) {
      sun.current.intensity = night ? 0.45 : 1.15;
      sun.current.color.set(night ? "#9eb4c8" : "#fff4df");
    }
    const index = Math.floor(shown.current * SITUATIONS.length + 0.5) % SITUATIONS.length;
    const name = SITUATIONS[index].name;
    if (name !== label.current) {
      label.current = name;
      const caption = document.querySelector("[data-situation]");
      const bar = document.querySelector("[data-track]");
      if (caption) {
        caption.textContent = name;
      }
      if (bar) {
        bar.setAttribute("aria-valuetext", name + ", " + (index + 1) + " of " + SITUATIONS.length);
      }
    }
    const mark = document.querySelector("[data-track-mark]");
    const bar = document.querySelector("[data-track]");
    if (mark) {
      mark.style.left = (shown.current * 100).toFixed(2) + "%";
    }
    if (bar) {
      bar.setAttribute("aria-valuenow", String(Math.round(shown.current * 100)));
    }
  });
  return (
    <>
      <ambientLight ref={ambient} intensity={0.72} />
      <hemisphereLight args={["#f4f7ef", "#6d8a55", 0.45]} />
      <directionalLight ref={sun} position={[4, 8, 2]} intensity={1.15} color="#fff4df" />
    </>
  );
}

function Stage({ yaw, night }) {
  const toon = useMemo(() => gradientMap(), []);
  const cache = useMemo(() => new Map(), [toon]);
  const materials = (part) => {
    const key = [part.c, part.o ?? 1, part.e || "", part.ei || 0].join("|");
    if (!cache.has(key)) {
      cache.set(
        key,
        new THREE.MeshToonMaterial({
          color: part.c,
          gradientMap: toon,
          transparent: (part.o ?? 1) < 1,
          opacity: part.o ?? 1,
          emissive: part.e || "#000000",
          emissiveIntensity: part.ei || 0,
        })
      );
    }
    return cache.get(key);
  };
  return (
    <>
      <Rig yaw={yaw} night={night} />
      <Grass night={night} />
      {SITUATIONS.map((spec, index) => (
        <Situation key={spec.name} spec={spec} index={index} materials={materials} />
      ))}
    </>
  );
}

export function Meadow() {
  const yaw = useRef(0);
  const [night, setNight] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const stage = document.querySelector("[data-meadow]");
    const track = document.querySelector("[data-track]");
    if (!stage) {
      return undefined;
    }
    const count = SITUATIONS.length;
    let drag = null;

    function wrap(value) {
      return ((value % 1) + 1) % 1;
    }

    function step(direction) {
      const index = Math.floor(yaw.current * count + 0.5) % count;
      yaw.current = wrap((index + direction) / count);
    }

    function onStageDown(event) {
      if (event.button !== 0) {
        return;
      }
      drag = { kind: "stage", x: event.clientX, yaw: yaw.current, id: event.pointerId };
      stage.setPointerCapture(event.pointerId);
      document.body.classList.add("is-turning");
    }
    function onStageMove(event) {
      if (!drag || drag.kind !== "stage" || drag.id !== event.pointerId) {
        return;
      }
      const delta = (event.clientX - drag.x) / Math.max(window.innerWidth, 1);
      yaw.current = wrap(drag.yaw - delta * 0.9);
    }
    function endDrag(event) {
      if (!drag || drag.id !== event.pointerId) {
        return;
      }
      drag = null;
      document.body.classList.remove("is-turning");
    }
    function onKey(event) {
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        event.preventDefault();
        step(1);
      }
    }
    function fromTrack(clientX) {
      const rect = track.getBoundingClientRect();
      yaw.current = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    }
    function onTrackDown(event) {
      drag = { kind: "track", id: event.pointerId };
      track.setPointerCapture(event.pointerId);
      fromTrack(event.clientX);
    }
    function onTrackMove(event) {
      if (!drag || drag.kind !== "track" || drag.id !== event.pointerId) {
        return;
      }
      fromTrack(event.clientX);
    }

    stage.addEventListener("pointerdown", onStageDown);
    stage.addEventListener("pointermove", onStageMove);
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("keydown", onKey);
    const turns = [];
    document.querySelectorAll("[data-turn]").forEach((button) => {
      const onClick = () => step(Number(button.getAttribute("data-turn")));
      button.addEventListener("click", onClick);
      turns.push([button, onClick]);
    });
    if (track) {
      track.addEventListener("pointerdown", onTrackDown);
      track.addEventListener("pointermove", onTrackMove);
      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);
      track.addEventListener("keydown", onKey);
    }
    const theme = new MutationObserver(() => {
      setNight(document.documentElement.classList.contains("dark"));
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      stage.removeEventListener("pointerdown", onStageDown);
      stage.removeEventListener("pointermove", onStageMove);
      stage.removeEventListener("pointerup", endDrag);
      stage.removeEventListener("pointercancel", endDrag);
      stage.removeEventListener("keydown", onKey);
      turns.forEach(([button, onClick]) => button.removeEventListener("click", onClick));
      if (track) {
        track.removeEventListener("pointerdown", onTrackDown);
        track.removeEventListener("pointermove", onTrackMove);
        track.removeEventListener("pointerup", endDrag);
        track.removeEventListener("pointercancel", endDrag);
        track.removeEventListener("keydown", onKey);
      }
      theme.disconnect();
    };
  }, []);

  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 1.75]}
      camera={{ fov: 30, near: 0.1, far: 80, position: [14, 1.7, 0] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <Stage yaw={yaw} night={night} />
    </Canvas>
  );
}
