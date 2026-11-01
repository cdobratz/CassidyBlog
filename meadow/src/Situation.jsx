import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SCENES } from "./props.js";

// The boy and his object are not models: each scene is one painted picture on
// a plane that always faces the camera. The shader keys out the magenta
// background, and a change of scene morphs one picture into the next by
// pulling the image toward five shared landmarks while the colour crossfades
// in a wave from left to right.

export const PLANE_W = 12;
export const PLANE_H = 8;
const POINTS = 5;
const RADII = [0.18, 0.17, 0.2, 0.14, 0.19];
const TRAVEL = 0.065; // the furthest a landmark is pulled, in image widths
const DURATION = 0.9; // seconds for one morph
// Add ?morph=0.5 to the URL to hold every change of scene part way through,
// which makes the landmark pull easy to judge when placing real art.
const HOLD = Number(new URLSearchParams(window.location.search).get("morph"));
const HELD = Number.isFinite(HOLD) && HOLD > 0 && HOLD < 1;

const vertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragment = `
precision highp float;
uniform sampler2D uTexA, uTexB;
uniform vec2 uLandA[${POINTS}], uLandB[${POINTS}];
uniform float uRadii[${POINTS}];
uniform float uProgress, uTravel;
uniform vec3 uTint;
varying vec2 vUv;

const vec2 ASPECT = vec2(${(PLANE_W / PLANE_H).toFixed(4)}, 1.0);
const vec3 KEY = vec3(1.0, 0.0, 1.0);

// Premultiplied colour with the magenta backing removed. Along a painted
// edge the pixel is a blend of paint and magenta, so taking the magenta's
// share back out leaves just the paint, already multiplied by its coverage.
vec4 cutout(vec4 c) {
  float key = min(c.r, c.b) - c.g;
  float alpha = 1.0 - smoothstep(0.12, 0.42, key);
  vec3 paint = max(c.rgb - KEY * (1.0 - alpha), 0.0);
  return vec4(paint, alpha);
}

void main() {
  float delay = vUv.x * 0.06;
  float t = smoothstep(delay, 0.94 + delay, uProgress);
  vec2 uvA = vUv;
  vec2 uvB = vUv;
  for (int i = 0; i < ${POINTS}; i++) {
    vec2 d = uLandB[i] - uLandA[i];
    float len = length(d);
    if (len > 1e-5) {
      d *= min(len, uTravel) / len;
    }
    vec2 at = uLandA[i] + d * t;
    vec2 q = (vUv - at) * ASPECT;
    float w = exp(-dot(q, q) / (2.0 * uRadii[i] * uRadii[i]));
    uvA -= d * t * w;
    uvB += d * (1.0 - t) * w;
  }
  vec4 a = cutout(texture2D(uTexA, uvA));
  vec4 b = cutout(texture2D(uTexB, uvB));
  float paint = smoothstep(0.24, 0.76, t);
  vec4 c = mix(a, b, paint);
  if (c.a < 0.01) discard;
  gl_FragColor = vec4(c.rgb * uTint, c.a);
}
`;

const wrap = (index) => ((index % SCENES.length) + SCENES.length) % SCENES.length;

// Landmarks are given from the top of the image; texture v runs from the bottom.
const toUv = ([x, y]) => new THREE.Vector2(x, 1 - y);

function loadTextures(onLoad) {
  const loader = new THREE.TextureLoader();
  const bySrc = new Map();
  const bySc = new Map();
  const get = (index) => bySc.get(wrap(index)) || null;
  const load = (index) => {
    const scene = SCENES[wrap(index)];
    if (!bySrc.has(scene.src)) {
      bySrc.set(
        scene.src,
        new Promise((resolve) => {
          loader.load(
            scene.src,
            (texture) => {
              texture.colorSpace = THREE.NoColorSpace;
              texture.wrapS = THREE.ClampToEdgeWrapping;
              texture.wrapT = THREE.ClampToEdgeWrapping;
              texture.minFilter = THREE.LinearMipmapLinearFilter;
              texture.magFilter = THREE.LinearFilter;
              texture.anisotropy = 4;
              resolve(texture);
            },
            undefined,
            () => resolve(null)
          );
        })
      );
    }
    return bySrc.get(scene.src).then((texture) => {
      if (texture && !bySc.has(wrap(index))) {
        bySc.set(wrap(index), texture);
        onLoad();
      }
      return texture;
    });
  };
  return { get, load, all: () => [...bySrc.values()] };
}

export function Situation({ turntable, reduced, night }) {
  const mesh = useRef(null);
  const state = useRef({ from: 0, to: 0, progress: 1 });

  const uniforms = useMemo(
    () => ({
      uTexA: { value: null },
      uTexB: { value: null },
      uLandA: { value: SCENES[0].landmarks.map(toUv) },
      uLandB: { value: SCENES[0].landmarks.map(toUv) },
      uRadii: { value: RADII.slice() },
      uProgress: { value: 1 },
      uTravel: { value: TRAVEL },
      uTint: { value: new THREE.Color(1, 1, 1) },
    }),
    []
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: true,
        side: THREE.DoubleSide,
      }),
    [uniforms]
  );

  const textures = useMemo(() => loadTextures(() => {}), []);

  useEffect(() => {
    // The first picture and its neighbours first, then the rest in the background.
    const first = [0, 1, -1].map((offset) => textures.load(offset));
    let cancelled = false;
    Promise.all(first).then(() => {
      if (cancelled) {
        return;
      }
      SCENES.forEach((_, index) => textures.load(index));
    });
    return () => {
      cancelled = true;
      textures.all().forEach((pending) => pending.then((texture) => texture?.dispose()));
      material.dispose();
    };
  }, [textures, material]);

  useFrame((_, delta) => {
    const s = state.current;
    const target = wrap(turntable.current.index);
    if (target !== s.to) {
      s.from = s.to;
      s.to = target;
      s.progress = 0;
      textures.load(target);
      textures.load(target + turntable.current.dir);
    }
    const texA = textures.get(s.from);
    const texB = textures.get(s.to);
    if (texA && texB) {
      s.progress = reduced ? 1 : Math.min(HELD ? HOLD : 1, s.progress + delta / DURATION);
    }
    const sceneA = SCENES[s.from];
    const sceneB = SCENES[s.to];
    uniforms.uTexA.value = texA || texB;
    uniforms.uTexB.value = texB || texA;
    uniforms.uProgress.value = texA && texB ? s.progress : texB ? 1 : 0;
    sceneA.landmarks.forEach(([x, y], index) => uniforms.uLandA.value[index].set(x, 1 - y));
    sceneB.landmarks.forEach(([x, y], index) => uniforms.uLandB.value[index].set(x, 1 - y));
    uniforms.uTint.value.set(night ? "#9aa7bd" : "#ffffff");

    if (mesh.current) {
      const ground = THREE.MathUtils.lerp(sceneA.ground, sceneB.ground, s.progress);
      mesh.current.position.y = (0.5 - ground) * PLANE_H;
      mesh.current.visible = Boolean(texA || texB);
    }
  });

  return (
    <mesh ref={mesh} material={material} visible={false} renderOrder={1} frustumCulled={false}>
      <planeGeometry args={[PLANE_W, PLANE_H, 100, 68]} />
    </mesh>
  );
}
