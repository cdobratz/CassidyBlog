import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Grass } from "./Grass.jsx";
import { BOY, SITUATIONS } from "./props.js";

// Turntable, after the reference meadow: an orthographic camera at a low,
// fixed elevation orbits the clearing one detent (15 degrees) per scene. The
// boy and his object always face the camera, so turning moves the field
// around them while one object at a time is swapped in beside him.

const SCENES = SITUATIONS.length; // 24
const STEP = (Math.PI * 2) / SCENES;
const ELEVATION = THREE.MathUtils.degToRad(10);
const DISTANCE = 40;
const FRAME = 6.4; // world units of frame height
const LOOK_Y = 1.75; // look above the boy so he sits in the lower half
const EASE = 9;
const WHEEL_GAP = 320; // ms between wheel detents
const DRAG_PX = 90; // pixels of drag per detent
const OUT = 0.2; // seconds for the old object to leave
const IN = 0.45; // seconds for the new one to arrive

const GEOMETRY = {
  box: "boxGeometry",
  cyl: "cylinderGeometry",
  sph: "sphereGeometry",
  cone: "coneGeometry",
  tor: "torusGeometry",
  oct: "octahedronGeometry",
  plane: "planeGeometry",
};

const wrap = (index) => ((index % SCENES) + SCENES) % SCENES;

function gradientMap() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  const image = context.createImageData(4, 1);
  [70, 130, 185, 255].forEach((shade, index) => {
    image.data.set([shade, shade, shade, 255], index * 4);
  });
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function useMaterials() {
  const toon = useMemo(() => gradientMap(), []);
  const cache = useMemo(() => new Map(), [toon]);
  return (part) => {
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
}

function Part({ part, material }) {
  const Tag = GEOMETRY[part.g] || "boxGeometry";
  return (
    <mesh position={part.p} rotation={part.r || [0, 0, 0]} scale={part.s} material={material}>
      <Tag args={part.a} />
    </mesh>
  );
}

function Parts({ parts, materials }) {
  return parts.map((part, index) => <Part key={index} part={part} material={materials(part)} />);
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
    group.current.children.forEach((drop, index) => {
      const cycle = (clock.elapsedTime * drops[index].speed + drops[index].offset) % 1;
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

const easeOutBack = (t) => {
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

// The one object currently beside the boy, and the swap between objects.
function Prop({ turntable, materials, reduced, swap }) {
  const holders = useRef([]);
  const state = useRef({ shown: 0, phase: "idle", time: 0, dir: 1 });

  useFrame(({ clock }, delta) => {
    const s = state.current;
    const target = wrap(turntable.current.index);
    if (reduced) {
      s.shown = target;
      s.phase = "idle";
    } else if (s.phase === "idle" && target !== s.shown) {
      s.phase = "out";
      s.time = 0;
      s.dir = turntable.current.dir;
      swap.current = 0;
    }
    if (s.phase === "out") {
      s.time += delta;
      if (s.time >= OUT) {
        s.shown = wrap(turntable.current.index);
        s.phase = "in";
        s.time = 0;
      }
    } else if (s.phase === "in") {
      s.time += delta;
      if (s.time >= IN) {
        s.phase = "idle";
        s.time = 0;
      }
    }
    swap.current = s.phase === "out" ? s.time / OUT : s.phase === "in" ? 1 + s.time / IN : 2;

    holders.current.forEach((node, index) => {
      if (!node) {
        return;
      }
      const spec = SITUATIONS[index];
      const on = index === s.shown;
      node.visible = on;
      if (!on) {
        return;
      }
      let scale = 1;
      let lift = 0;
      let spin = 0;
      if (s.phase === "out") {
        const t = s.time / OUT;
        scale = 1 - t * t;
        lift = -0.25 * t;
        spin = s.dir * t * 0.9;
      } else if (s.phase === "in") {
        const t = s.time / IN;
        scale = Math.max(0.001, easeOutBack(t));
        lift = Math.sin(t * Math.PI) * 0.35;
        spin = -s.dir * (1 - t) * 0.9;
      }
      const hover = spec.float ? Math.sin(clock.elapsedTime * 0.9) * 0.07 : 0;
      node.scale.setScalar(Math.max(0.001, scale) * 1.2);
      node.position.y = (spec.float || 0) + hover + lift;
      node.rotation.y = spin;
    });
  });

  return (
    <group position={[0.62, 0, 0.05]}>
      {SITUATIONS.map((spec, index) => (
        <group key={spec.name} ref={(node) => (holders.current[index] = node)} visible={index === 0}>
          <Parts parts={spec.parts} materials={materials} />
          {spec.rain ? <Rain /> : null}
        </group>
      ))}
    </group>
  );
}

// The boy: idle breathing, a blink of a hop and a glance at each new object.
function Boy({ materials, reduced, swap }) {
  const root = useRef(null);
  const torso = useRef(null);
  const head = useRef(null);
  const armL = useRef(null);
  const armR = useRef(null);

  useFrame(({ clock }) => {
    const time = reduced ? 0 : clock.elapsedTime;
    const k = swap.current; // 0..1 leaving, 1..2 arriving, 2 idle
    const arrive = k >= 1 && k < 2 ? k - 1 : 0;
    const hop = Math.sin(arrive * Math.PI) * 0.16;
    const look = k < 2 ? Math.sin(Math.min(1, k / 2) * Math.PI) : 0;
    if (root.current) {
      root.current.position.y = hop;
      root.current.rotation.y = 0.32 + look * 0.25 + Math.sin(time * 0.4) * 0.03;
    }
    if (torso.current) {
      torso.current.scale.y = 1 + Math.sin(time * 1.6) * 0.012;
    }
    if (head.current) {
      head.current.rotation.z = Math.sin(time * 0.7) * 0.04 - look * 0.12;
      head.current.rotation.x = look * 0.08;
      head.current.position.y = 1.24 + Math.sin(time * 1.6) * 0.006;
    }
    if (armR.current) {
      // Reaches toward the object as it lands.
      armR.current.rotation.z = 0.12 + look * 0.95;
      armR.current.rotation.x = -look * 0.6;
    }
    if (armL.current) {
      armL.current.rotation.z = -0.12 - Math.sin(time * 1.1) * 0.03;
    }
  });

  return (
    <group position={[-0.62, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.6, 0.02, 0]}>
        <circleGeometry args={[1.25, 32]} />
        <meshBasicMaterial color="#1c2418" transparent opacity={0.13} depthWrite={false} />
      </mesh>
      <group ref={root} scale={1.05}>
        <Parts parts={BOY.legs} materials={materials} />
        <group ref={torso}>
          <Parts parts={BOY.body} materials={materials} />
        </group>
        <group ref={armL} position={[-0.25, 1.12, 0]}>
          <Parts parts={BOY.arm} materials={materials} />
        </group>
        <group ref={armR} position={[0.25, 1.12, 0]}>
          <Parts parts={BOY.arm} materials={materials} />
        </group>
        <group ref={head} position={[0, 1.24, 0]}>
          <Parts parts={BOY.head} materials={materials} />
        </group>
      </group>
    </group>
  );
}

function Rig({ turntable, night }) {
  const ambient = useRef(null);
  const sun = useRef(null);
  const { camera, size } = useThree();
  const centre = useMemo(() => new THREE.Vector3(0, LOOK_Y, 0), []);

  useFrame((_, delta) => {
    const tt = turntable.current;
    const target = tt.index * STEP;
    tt.azimuth = tt.reduced ? target : tt.azimuth + (target - tt.azimuth) * (1 - Math.exp(-delta * EASE));
    if (Math.abs(target - tt.azimuth) < 1e-4) {
      tt.azimuth = target;
    }
    const flat = Math.cos(ELEVATION) * DISTANCE;
    camera.position.set(
      centre.x + Math.cos(tt.azimuth) * flat,
      centre.y + Math.sin(ELEVATION) * DISTANCE,
      centre.z + Math.sin(tt.azimuth) * flat
    );
    camera.lookAt(centre);
    camera.zoom = size.height / FRAME;
    camera.updateProjectionMatrix();

    if (ambient.current) {
      ambient.current.intensity = night ? 0.34 : 0.72;
    }
    if (sun.current) {
      sun.current.intensity = night ? 0.45 : 1.15;
      sun.current.color.set(night ? "#9eb4c8" : "#fff4df");
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

// Boy and object together, always turned to face the camera. The pair lags
// the camera a touch, so each turn shows a little of their sides.
function Clearing({ turntable, reduced }) {
  const group = useRef(null);
  const materials = useMaterials();
  const swap = useRef(2);
  const facing = useRef(Math.PI / 2);
  useFrame((_, delta) => {
    const want = Math.PI / 2 - turntable.current.azimuth;
    facing.current = reduced ? want : facing.current + (want - facing.current) * (1 - Math.exp(-delta * 5.5));
    if (group.current) {
      group.current.rotation.y = facing.current;
    }
  });
  return (
    <group ref={group}>
      <Boy materials={materials} reduced={reduced} swap={swap} />
      <Prop turntable={turntable} materials={materials} reduced={reduced} swap={swap} />
    </group>
  );
}

export function Meadow() {
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const turntable = useRef({ index: 0, azimuth: 0, dir: 1, reduced });
  const [night, setNight] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const stage = document.querySelector("[data-meadow]");
    const track = document.querySelector("[data-track]");
    const mark = document.querySelector("[data-track-mark]");
    const caption = document.querySelector("[data-situation]");
    if (!stage) {
      return undefined;
    }
    const tt = turntable.current;

    function render() {
      const scene = wrap(tt.index);
      const name = SITUATIONS[scene].name;
      if (caption) {
        caption.textContent = name;
      }
      if (mark) {
        mark.style.left = (((scene + 0.5) / SCENES) * 100).toFixed(2) + "%";
      }
      if (track) {
        track.setAttribute("aria-valuenow", String(scene));
        track.setAttribute("aria-valuetext", name + ", " + (scene + 1) + " of " + SCENES);
      }
    }
    function turn(step) {
      if (!step) {
        return;
      }
      tt.index += step;
      tt.dir = Math.sign(step);
      render();
    }
    function goToScene(scene) {
      let step = wrap(scene - wrap(tt.index));
      if (step > SCENES / 2) {
        step -= SCENES;
      }
      turn(step);
    }

    // Wheel or trackpad scroll: one detent at a time.
    let wheelReady = 0;
    function onWheel(event) {
      if (event.target.closest?.("header, nav, .mast, .site-header, footer, .track")) {
        return;
      }
      const value = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(value) < 2) {
        return;
      }
      event.preventDefault();
      const now = performance.now();
      if (now < wheelReady) {
        return;
      }
      wheelReady = now + WHEEL_GAP;
      turn(Math.sign(value));
    }

    let drag = null;
    function onStageDown(event) {
      if (event.button !== 0) {
        return;
      }
      drag = { kind: "stage", x: event.clientX, from: tt.index, id: event.pointerId };
      stage.setPointerCapture(event.pointerId);
      document.body.classList.add("is-turning");
    }
    function onStageMove(event) {
      if (!drag || drag.kind !== "stage" || drag.id !== event.pointerId) {
        return;
      }
      const next = drag.from - Math.round((event.clientX - drag.x) / DRAG_PX);
      turn(next - tt.index);
    }
    function endDrag(event) {
      if (!drag || drag.id !== event.pointerId) {
        return;
      }
      drag = null;
      document.body.classList.remove("is-turning");
    }
    function onKey(event) {
      const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
      if (step) {
        event.preventDefault();
        turn(step);
      }
    }
    function fromTrack(clientX) {
      const rect = track.getBoundingClientRect();
      const at = (clientX - rect.left) / Math.max(rect.width, 1);
      goToScene(THREE.MathUtils.clamp(Math.floor(at * SCENES), 0, SCENES - 1));
    }
    function onTrackDown(event) {
      drag = { kind: "track", id: event.pointerId };
      track.setPointerCapture(event.pointerId);
      fromTrack(event.clientX);
    }
    function onTrackMove(event) {
      if (drag && drag.kind === "track" && drag.id === event.pointerId) {
        fromTrack(event.clientX);
      }
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onStageDown);
    stage.addEventListener("pointermove", onStageMove);
    stage.addEventListener("pointerup", endDrag);
    stage.addEventListener("pointercancel", endDrag);
    stage.addEventListener("keydown", onKey);
    const turns = [];
    document.querySelectorAll("[data-turn]").forEach((button) => {
      const onClick = () => turn(Number(button.getAttribute("data-turn")));
      button.addEventListener("click", onClick);
      turns.push([button, onClick]);
    });
    if (track) {
      track.setAttribute("aria-valuemax", String(SCENES - 1));
      track.addEventListener("pointerdown", onTrackDown);
      track.addEventListener("pointermove", onTrackMove);
      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);
      track.addEventListener("keydown", onKey);
    }
    render();
    const theme = new MutationObserver(() => {
      setNight(document.documentElement.classList.contains("dark"));
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      window.removeEventListener("wheel", onWheel);
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
      orthographic
      gl={{ alpha: true, antialias: true }}
      dpr={[1, 1.75]}
      camera={{ near: 0.1, far: 200, position: [DISTANCE, 7, 0], zoom: 100 }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <Rig turntable={turntable} night={night} />
      <Grass night={night} reduced={reduced} />
      <Clearing turntable={turntable} reduced={reduced} />
    </Canvas>
  );
}
