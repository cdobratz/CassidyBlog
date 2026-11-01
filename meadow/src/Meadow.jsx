import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Grass } from "./Grass.jsx";
import { Situation } from "./Situation.jsx";
import { SCENES } from "./props.js";

// Turntable, after the reference meadow: an orthographic camera at a low,
// fixed elevation orbits the clearing one detent (15 degrees) per scene. The
// painted boy and his object always face the camera, so turning moves the
// field around them while the picture morphs to the next scene.

const COUNT = SCENES.length; // 24
const STEP = (Math.PI * 2) / COUNT;
const ELEVATION = THREE.MathUtils.degToRad(10);
const DISTANCE = 40;
const FRAME = 6.4; // world units of frame height
// The reference frames a 26-unit-tall view around a 12 x 8 picture; the
// picture is scaled so it takes the same share of our frame.
const ART = FRAME / 21;
const LOOK_Y = 1.7; // look above the boy so the mound sits in the lower half
const EASE = 9;
const WHEEL_GAP = 320; // ms between wheel detents
const DRAG_PX = 90; // pixels of drag per detent

const wrap = (index) => ((index % COUNT) + COUNT) % COUNT;

function Rig({ turntable }) {
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
  });

  return null;
}

// The picture, always turned square to the camera.
function Clearing({ turntable, reduced, night }) {
  const group = useRef(null);
  useFrame(() => {
    if (group.current) {
      group.current.rotation.y = Math.PI / 2 - turntable.current.azimuth;
    }
  });
  return (
    <group ref={group} scale={ART}>
      <Situation turntable={turntable} reduced={reduced} night={night} />
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
      const name = SCENES[scene].name;
      if (caption) {
        caption.textContent = name;
      }
      if (mark) {
        mark.style.left = (((scene + 0.5) / COUNT) * 100).toFixed(2) + "%";
      }
      if (track) {
        track.setAttribute("aria-valuenow", String(scene));
        track.setAttribute("aria-valuetext", name + ", " + (scene + 1) + " of " + COUNT);
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
      if (step > COUNT / 2) {
        step -= COUNT;
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
      goToScene(THREE.MathUtils.clamp(Math.floor(at * COUNT), 0, COUNT - 1));
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
      track.setAttribute("aria-valuemax", String(COUNT - 1));
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
      <Rig turntable={turntable} />
      <Grass night={night} reduced={reduced} />
      <Clearing turntable={turntable} reduced={reduced} night={night} />
    </Canvas>
  );
}
