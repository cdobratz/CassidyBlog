import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RING, SITUATIONS } from "./props.js";

const vertex = `
attribute vec3 aColor;
attribute float aLean;
attribute float aPhase;
varying vec3 vColor;
varying float vHeight;
uniform float uTime;
void main() {
  vHeight = uv.y;
  vColor = aColor;
  vec3 p = position;
  float gust = sin(uTime * 1.35 + aPhase) * 0.16 * vHeight * vHeight;
  p.x += gust + aLean * vHeight;
  vec4 world = instanceMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fragment = `
varying vec3 vColor;
varying float vHeight;
uniform vec3 uTip;
void main() {
  vec3 color = mix(vColor, uTip, smoothstep(0.55, 1.0, vHeight));
  gl_FragColor = vec4(color, 1.0);
}
`;

function hash(index) {
  const value = Math.sin(index * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

const DAY = ["#3e5c38", "#5a7844", "#6e944c", "#87a56a"];
const NIGHT = ["#1c3328", "#24382c", "#3a5644", "#4e6a52"];

export function Grass({ night }) {
  const mesh = useRef(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uTip: { value: new THREE.Color("#e4efc8") },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
        side: THREE.DoubleSide,
      }),
    []
  );

  const { geometry, count } = useMemo(() => {
    const bladeCount = 3600;
    const geom = new THREE.PlaneGeometry(0.16, 1, 1, 3);
    geom.translate(0, 0.5, 0);
    const colors = new Float32Array(bladeCount * 3);
    const leans = new Float32Array(bladeCount);
    const phases = new Float32Array(bladeCount);
    const matrices = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < bladeCount; i += 1) {
      const angle = hash(i + 1) * Math.PI * 2;
      const radius = Math.pow(hash(i + 2), 0.72) * (RING + 1.4);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      let height = 0.16 + hash(i + 5) * 0.28;
      for (let spot = 0; spot < SITUATIONS.length; spot += 1) {
        const spotAngle = (spot / SITUATIONS.length) * Math.PI * 2;
        const dx = x - Math.cos(spotAngle) * RING;
        const dz = z - Math.sin(spotAngle) * RING;
        if (dx * dx + dz * dz < 2.2) {
          height *= 0.35;
          break;
        }
      }
      dummy.position.set(x, 0, z);
      dummy.rotation.y = hash(i + 6) * Math.PI;
      dummy.scale.set(0.7 + hash(i + 7), height, 1);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      leans[i] = (hash(i + 11) - 0.5) * 0.35;
      phases[i] = hash(i + 12) * Math.PI * 2;
    }
    geom.setAttribute("aColor", new THREE.InstancedBufferAttribute(colors, 3));
    geom.setAttribute("aLean", new THREE.InstancedBufferAttribute(leans, 1));
    geom.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
    geom.userData.matrices = matrices;
    return { geometry: geom, count: bladeCount };
  }, []);

  const flowers = useMemo(() => {
    const spots = [];
    for (let i = 0; i < 80; i += 1) {
      const angle = hash(i + 3) * Math.PI * 2;
      const radius = 0.5 + Math.pow(hash(i + 9), 0.65) * 7.1;
      spots.push({
        position: [Math.cos(angle) * radius, 0.06, Math.sin(angle) * radius],
        color: ["#c4532e", "#f7f3ea", "#6d92b0"][i % 3],
        scale: 0.03 + hash(i + 4) * 0.028,
      });
    }
    return spots;
  }, []);

  useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) {
      return;
    }
    geometry.userData.matrices.forEach((matrix, index) => node.setMatrixAt(index, matrix));
    node.instanceMatrix.needsUpdate = true;
    const palette = (night ? NIGHT : DAY).map((hex) => new THREE.Color(hex));
    const colorAttr = geometry.getAttribute("aColor");
    for (let i = 0; i < count; i += 1) {
      const color = palette[Math.floor(hash(i + 8) * palette.length)];
      colorAttr.setXYZ(i, color.r, color.g, color.b);
    }
    colorAttr.needsUpdate = true;
  }, [night, geometry, count]);

  useFrame(({ clock }) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    material.uniforms.uTime.value = reduced ? 0 : clock.elapsedTime;
    material.uniforms.uTip.value.set(night ? "#8ea48a" : "#e4efc8");
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[RING + 2.2, 48]} />
        <meshBasicMaterial color={night ? "#24382c" : "#7d9a62"} transparent opacity={0.42} />
      </mesh>
      <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />
      {flowers.map((flower, index) => (
        <mesh key={index} position={flower.position} scale={flower.scale}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color={flower.color} />
        </mesh>
      ))}
    </group>
  );
}
