import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// A field of camera-facing grass blades. The technique follows the reference
// meadow: each blade is a thin strip billboarded about Y, it leans in a WORLD
// direction (so turning the camera never turns the weather), and wind is one
// noise field sliding across the ground, so gusts travel as waves instead of
// every blade waving on its own clock.

export const FIELD = 10.5; // radius of the grass disc
export const CLEARING = 1.7; // short grass where the boy stands

const NOISE = `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}
uniform vec3 uGrass, uPale, uDeep, uWarm, uCold;
// The same colour for a blade's root and the ground under it, so the two
// read as one mass.
vec3 groundColour(vec2 xz) {
  float n = fbm(xz * 0.17 + 3.1);
  vec3 c = uGrass;
  c = mix(c, uWarm, smoothstep(0.58, 0.82, n) * 0.28);
  c = mix(c, uCold, smoothstep(0.42, 0.18, n) * 0.34);
  return c;
}
`;

const bladeVertex = `
attribute vec3 iPos;
attribute vec4 iParams;   // height, width, resting lean, phase
attribute vec2 iLean;     // world direction of the resting lean
attribute vec2 iFace;     // cos/sin yaw off camera-facing
attribute float iDelay;   // when it sprouts
attribute float iShape;   // profile roundness
attribute float iShade;   // per-blade value jitter
uniform float uTime, uWind, uGust, uGrow;
uniform vec2 uWindDir;
varying vec3 vColor;
${NOISE}
void main() {
  float t = position.y;
  float g = clamp((uGrow - iDelay) / 0.32, 0.0, 1.0);
  g = g * g * (3.0 - 2.0 * g);
  if (g <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }

  vec3 toCam = cameraPosition - iPos;
  toCam.y = 0.0;
  vec3 f = normalize(toCam);
  vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), f));
  vec3 side = normalize(r * iFace.x + f * iFace.y);

  float phase = iParams.w;
  vec3 push = vec3(iLean.x, 0.0, iLean.y) * iParams.z;
  float wave = fbm(iPos.xz * 0.13 - uWindDir * uTime * 1.15) * 2.0 - 1.0;
  float flutter = sin(uTime * 3.3 + phase * 2.1) * 0.09;
  float force = max(0.0, uWind * (0.42 + uGust * wave) + flutter * uWind);
  push += vec3(uWindDir.x, 0.0, uWindDir.y) * force;
  float pl = length(push);
  if (pl > 1.5) push *= 1.5 / pl;

  float h = iParams.x * g;
  float w = iParams.y * pow(max(0.0, 1.0 - pow(t, iShape)), 0.42);
  float curve = t * t;
  float over = dot(push, push);
  float wobble = sin(t * 6.5 + phase * 4.0) * 0.018;
  vec3 p = iPos
    + side * (position.x * w + wobble * h)
    + push * (curve * h)
    + vec3(0.0, 1.0, 0.0) * (t * h * (1.0 - 0.18 * min(over, 2.0) * curve));

  vec3 green = groundColour(iPos.xz) * (0.9 + 0.2 * iShade);
  // Down among the other blades it is darker; the top catches the light.
  green = mix(uDeep, green, 0.4 + 0.6 * smoothstep(0.0, 0.62, t));
  green = mix(green, uPale, smoothstep(0.72, 1.0, t) * 0.45);
  vColor = green;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const bladeFragment = `
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor, 1.0);
  #include <colorspace_fragment>
}
`;

const groundVertex = `
varying vec2 vXZ;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vXZ = world.xz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const groundFragment = `
varying vec2 vXZ;
uniform float uRadius;
${NOISE}
void main() {
  float d = length(vXZ) / uRadius;
  float edge = 1.0 - smoothstep(0.86, 1.0, d + (fbm(vXZ * 0.6) - 0.5) * 0.08);
  if (edge <= 0.01) discard;
  vec3 c = mix(uDeep, groundColour(vXZ), 0.62);
  gl_FragColor = vec4(c, edge);
  #include <colorspace_fragment>
}
`;

const PALETTE = {
  day: { grass: "#84a555", pale: "#c9d49a", deep: "#2f4a2a", warm: "#d06a49", cold: "#bfb788" },
  night: { grass: "#36443a", pale: "#5c6a58", deep: "#0b1714", warm: "#7d3a1c", cold: "#566276" },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bladeStrip(segments) {
  const geom = new THREE.InstancedBufferGeometry();
  const pos = [];
  const idx = [];
  for (let i = 0; i <= segments; i += 1) {
    const y = 1 - Math.pow(1 - i / segments, 1.7);
    pos.push(-0.5, y, 0, 0.5, y, 0);
  }
  for (let i = 0; i < segments; i += 1) {
    const e = i * 2;
    idx.push(e, e + 1, e + 2, e + 1, e + 3, e + 2);
  }
  geom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geom.setIndex(idx);
  return geom;
}

export function makeUniforms() {
  return {
    uTime: { value: 0 },
    uWind: { value: 0.55 },
    uGust: { value: 0.85 },
    uWindDir: { value: new THREE.Vector2(0.82, 0.57).normalize() },
    uGrow: { value: 0 },
    uRadius: { value: FIELD },
    uGrass: { value: new THREE.Color() },
    uPale: { value: new THREE.Color() },
    uDeep: { value: new THREE.Color() },
    uWarm: { value: new THREE.Color() },
    uCold: { value: new THREE.Color() },
  };
}

export function Grass({ night, reduced }) {
  const uniforms = useMemo(() => makeUniforms(), []);

  const { blades, ground, flowers } = useMemo(() => {
    const small = window.innerWidth < 720;
    const count = reduced ? 9000 : small ? 16000 : 30000;
    const random = rng(7);
    const geom = bladeStrip(6);
    const iPos = new Float32Array(count * 3);
    const iParams = new Float32Array(count * 4);
    const iLean = new Float32Array(count * 2);
    const iFace = new Float32Array(count * 2);
    const iDelay = new Float32Array(count);
    const iShape = new Float32Array(count);
    const iShade = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * FIELD;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      // Short in the clearing, tallest mid-field, thinning at the rim.
      const clear = THREE.MathUtils.smoothstep(radius, CLEARING * 0.6, CLEARING * 1.5);
      const rim = 1 - THREE.MathUtils.smoothstep(radius, FIELD * 0.78, FIELD);
      const height = (0.12 + random() * 0.42) * (0.3 + 0.7 * clear) * (0.35 + 0.65 * rim);
      iPos.set([x, 0, z], i * 3);
      iParams.set([height, 0.07 + random() * 0.08, 0.15 + random() * 0.35, random() * Math.PI * 2], i * 4);
      const leanAngle = random() * Math.PI * 2;
      iLean.set([Math.cos(leanAngle), Math.sin(leanAngle)], i * 2);
      const face = (random() - 0.5) * 1.1;
      iFace.set([Math.cos(face), Math.sin(face)], i * 2);
      // Sprout from the middle outwards.
      iDelay[i] = (radius / FIELD) * 0.75 + random() * 0.2;
      iShape[i] = 1.6 + random() * 2.4;
      iShade[i] = random();
    }
    const inst = (array, size) => new THREE.InstancedBufferAttribute(array, size);
    geom.setAttribute("iPos", inst(iPos, 3));
    geom.setAttribute("iParams", inst(iParams, 4));
    geom.setAttribute("iLean", inst(iLean, 2));
    geom.setAttribute("iFace", inst(iFace, 2));
    geom.setAttribute("iDelay", inst(iDelay, 1));
    geom.setAttribute("iShape", inst(iShape, 1));
    geom.setAttribute("iShade", inst(iShade, 1));
    geom.instanceCount = count;

    const bladeMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: bladeVertex,
      fragmentShader: bladeFragment,
      side: THREE.DoubleSide,
    });
    const bladeMesh = new THREE.Mesh(geom, bladeMaterial);
    bladeMesh.frustumCulled = false;

    const groundMesh = new THREE.Mesh(
      new THREE.CircleGeometry(FIELD * 1.04, 72),
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: groundVertex,
        fragmentShader: groundFragment,
        transparent: true,
        depthWrite: false,
      })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.01;
    groundMesh.renderOrder = -1;

    const dots = [];
    const flowerRandom = rng(19);
    for (let i = 0; i < 70; i += 1) {
      const angle = flowerRandom() * Math.PI * 2;
      const radius = CLEARING * 1.3 + Math.sqrt(flowerRandom()) * (FIELD * 0.8 - CLEARING * 1.3);
      dots.push({
        position: [Math.cos(angle) * radius, 0.14 + flowerRandom() * 0.18, Math.sin(angle) * radius],
        color: ["#f7f3ea", "#e2b656", "#c4532e", "#e7b7c6"][i % 4],
        scale: 0.035 + flowerRandom() * 0.03,
      });
    }
    return { blades: bladeMesh, ground: groundMesh, flowers: dots };
  }, [uniforms, reduced]);

  useFrame(({ clock }, delta) => {
    const palette = night ? PALETTE.night : PALETTE.day;
    uniforms.uGrass.value.set(palette.grass);
    uniforms.uPale.value.set(palette.pale);
    uniforms.uDeep.value.set(palette.deep);
    uniforms.uWarm.value.set(palette.warm);
    uniforms.uCold.value.set(palette.cold);
    uniforms.uTime.value = reduced ? 0 : clock.elapsedTime;
    uniforms.uGrow.value = reduced ? 1.3 : Math.min(1.3, uniforms.uGrow.value + delta * 0.45);
  });

  return (
    <group>
      <primitive object={ground} />
      <primitive object={blades} />
      {flowers.map((flower, index) => (
        <mesh key={index} position={flower.position} scale={flower.scale}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color={flower.color} />
        </mesh>
      ))}
    </group>
  );
}
