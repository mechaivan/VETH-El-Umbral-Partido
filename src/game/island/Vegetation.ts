import * as THREE from "three";
import { angularRadius, surfaceHeight } from "./Island";
import { hash2 } from "./noise";
import {
  addLeafMass,
  addTube,
  createBladeClusterGeometry,
  createRockGeometry,
  FaceBaker,
  mRot,
  mTrans,
  orientTo,
} from "../shapes";

/**
 * VETH — Fase 2.2 / revisión artística 2.2.1
 * Decoración y vegetación del Nivel 1.
 *
 * Todos los assets se construyen con la librería de formas diseñadas
 * (src/game/shapes.ts): troncos y ramas como tubos cónicos continuos con
 * raíces integradas, copas como masa vegetal cerrada, hierba con volumen
 * real y rocas con silueta trabajada.
 *
 * Se conserva la infraestructura de la Fase 2.2: composición autorizada
 * (arboledas, ejemplares aislados, claros reservados), colocación
 * determinista, instancing y solo dos materiales.
 */

/* ------------------------------------------------------------------ */
/* Paleta                                                              */
/* ------------------------------------------------------------------ */

const BARK_DARK = new THREE.Color(0x332c25);
const BARK_MID = new THREE.Color(0x453b30);
const BARK_PALE = new THREE.Color(0x554a3c);
const DEAD_DARK = new THREE.Color(0x453f36);
const DEAD_PALE = new THREE.Color(0x625a4c);
const LEAF_LOW = new THREE.Color(0x232e20);
const LEAF_HIGH = new THREE.Color(0x415030);
const BUSH_LOW = new THREE.Color(0x212b1f);
const BUSH_HIGH = new THREE.Color(0x38462b);
const GRASS_BASE = new THREE.Color(0x2f3c26);
const GRASS_TIP = new THREE.Color(0x5a6a41);
const DRY_BASE = new THREE.Color(0x453b28);
const DRY_TIP = new THREE.Color(0x6f6140);
const ROCK_BASE = new THREE.Color(0x474540);
const ROCK_TOP = new THREE.Color(0x6b6759);
const ROCK_MOSS = new THREE.Color(0x3e4a33);
const SOIL = new THREE.Color(0x3f3527);

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

/** PRNG determinista (LCG). */
function makeRng(seed: number): () => number {
  let s = (seed * 16807) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Raíces que nacen del propio tronco y se hunden en el terreno. */
function addRoots(
  baker: FaceBaker,
  count: number,
  trunkRadius: number,
  reach: number,
  color: THREE.Color,
  seed: number
): void {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + hash2(seed, i * 2.3) * 0.7;
    const len = reach * (0.75 + hash2(seed + 1, i) * 0.6);
    const start = V(
      Math.cos(a) * trunkRadius * 0.55,
      0.16 + hash2(seed + 2, i) * 0.12,
      Math.sin(a) * trunkRadius * 0.55
    );
    const dir = V(Math.cos(a) * 0.72, -0.5, Math.sin(a) * 0.72);
    addTube(
      baker,
      orientTo(start, dir),
      [
        { r: trunkRadius * 0.42, len: len * 0.5, tiltX: 0.12 },
        { r: trunkRadius * 0.26, len: len * 0.5, tiltX: 0.5 },
        { r: 0.03 },
      ],
      4,
      (t) => color.clone().lerp(SOIL, 0.25 + t * 0.3),
      seed + i * 3.1,
      0.2
    );
  }
}

/** Rama cónica con codo y punta afilada. Devuelve la posición del extremo. */
function addBranch(
  baker: FaceBaker,
  from: THREE.Matrix4,
  yaw: number,
  pitch: number,
  length: number,
  radius: number,
  colorNear: THREE.Color,
  colorFar: THREE.Color,
  seed: number,
  segments = 3
): THREE.Vector3 {
  const start = from.clone().multiply(mRot(0, yaw, 0)).multiply(mRot(pitch, 0, 0));
  const nodes = [];
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    nodes.push({
      r: radius * (1 - t * 0.72),
      len: (length / segments) * (1 - t * 0.18),
      tiltX: i === 0 ? 0 : 0.18 + hash2(seed, i) * 0.3,
      tiltZ: i === 0 ? 0 : (hash2(seed + 1, i) - 0.5) * 0.5,
    });
  }
  nodes.push({ r: radius * 0.12 });
  const end = addTube(
    baker,
    start,
    nodes,
    4,
    (t) => colorNear.clone().lerp(colorFar, t),
    seed,
    0.18
  );
  return new THREE.Vector3().setFromMatrixPosition(end);
}

/* ------------------------------------------------------------------ */
/* Arquetipos de árbol                                                 */
/* ------------------------------------------------------------------ */

type TreeKind = "gnarled" | "dead" | "bramble";

/** Árbol retorcido con copa continua. */
function buildGnarledTree(): THREE.BufferGeometry {
  const seed = 3.7;
  const baker = new FaceBaker(seed, 0.2);
  const bark = (t: number) => BARK_DARK.clone().lerp(BARK_PALE, t * 0.8);

  addRoots(baker, 5, 0.44, 0.75, BARK_DARK, seed);

  // Tronco inferior: ensanchado en la base, torsión marcada
  const mid = addTube(
    baker,
    mTrans(0, -0.25, 0),
    [
      { r: 0.46, len: 0.5 },
      { r: 0.36, len: 0.62, tiltX: 0.14, tiltZ: -0.1 },
      { r: 0.3, len: 0.66, tiltX: -0.18, tiltZ: 0.16 },
    ],
    6,
    (t) => bark(t * 0.4),
    seed,
    0.12,
    false
  );
  // Tronco superior, inclinado hacia el lado contrario
  const top = addTube(
    baker,
    mid.clone(),
    [
      { r: 0.3 },
      { r: 0.24, len: 0.6, tiltX: 0.22, tiltZ: 0.1 },
      { r: 0.17, len: 0.55, tiltX: -0.12, tiltZ: -0.2 },
    ],
    6,
    (t) => bark(0.4 + t * 0.5),
    seed + 5,
    0.12,
    false
  );

  // Ramas principales asimétricas
  const tips: THREE.Vector3[] = [];
  tips.push(addBranch(baker, mid.clone().multiply(mTrans(0, -0.2, 0)), 0.6, 0.95, 1.25, 0.15, BARK_MID, BARK_PALE, seed + 11));
  tips.push(addBranch(baker, top.clone().multiply(mTrans(0, -0.35, 0)), 2.7, 0.8, 1.35, 0.14, BARK_MID, BARK_PALE, seed + 13));
  tips.push(addBranch(baker, top.clone(), 4.6, 0.62, 1.1, 0.12, BARK_MID, BARK_PALE, seed + 17));
  const crown = new THREE.Vector3().setFromMatrixPosition(top);

  // Copa: masas muy solapadas → se lee como una sola silueta vegetal
  addLeafMass(baker, crown.clone().add(V(0, 0.75, 0)), 1.32, seed, LEAF_LOW, LEAF_HIGH, {
    lobes: 3,
    squash: 0.72,
  });
  addLeafMass(baker, tips[0].clone().add(V(0, 0.28, 0)), 0.92, seed + 2.4, LEAF_LOW, LEAF_HIGH, {
    lat: 4,
    lon: 7,
    lobes: 2,
    squash: 0.68,
  });
  addLeafMass(baker, tips[1].clone().add(V(0, 0.3, 0)), 1.02, seed + 4.8, LEAF_LOW, LEAF_HIGH, {
    lat: 4,
    lon: 7,
    lobes: 4,
    squash: 0.7,
  });
  addLeafMass(baker, tips[2].clone().add(V(0, 0.22, 0)), 0.78, seed + 7.1, LEAF_LOW, LEAF_HIGH, {
    lat: 4,
    lon: 6,
    lobes: 3,
    squash: 0.66,
  });

  return baker.build();
}

/** Árbol muerto: silueta agresiva, ramas largas y quebradas. */
function buildDeadTree(): THREE.BufferGeometry {
  const seed = 8.2;
  const baker = new FaceBaker(seed, 0.2);
  const wood = (t: number) => DEAD_DARK.clone().lerp(DEAD_PALE, t);

  addRoots(baker, 6, 0.5, 0.95, DEAD_DARK, seed);

  const mid = addTube(
    baker,
    mTrans(0, -0.3, 0),
    [
      { r: 0.5, len: 0.55 },
      { r: 0.37, len: 0.7, tiltX: -0.1, tiltZ: 0.12 },
      { r: 0.29, len: 0.75, tiltX: 0.16, tiltZ: -0.08 },
    ],
    6,
    (t) => wood(t * 0.4),
    seed,
    0.14,
    false
  );
  const top = addTube(
    baker,
    mid.clone(),
    [
      { r: 0.29 },
      { r: 0.21, len: 0.8, tiltX: 0.1, tiltZ: 0.16 },
      { r: 0.13, len: 0.7, tiltX: -0.22, tiltZ: -0.1 },
      { r: 0.05, len: 0.4, tiltX: 0.3, tiltZ: 0.12 },
    ],
    5,
    (t) => wood(0.4 + t * 0.6),
    seed + 3,
    0.16
  );

  // Ramas largas, secas y desiguales
  const branchSpecs: Array<[THREE.Matrix4, number, number, number, number]> = [
    [mid.clone().multiply(mTrans(0, -0.3, 0)), 0.4, 1.05, 1.7, 0.14],
    [mid.clone(), 2.2, 0.85, 1.95, 0.13],
    [top.clone().multiply(mTrans(0, -1.2, 0)), 3.6, 0.7, 1.75, 0.12],
    [top.clone().multiply(mTrans(0, -0.9, 0)), 5.1, 0.95, 1.45, 0.11],
    [top.clone().multiply(mTrans(0, -0.4, 0)), 1.3, 0.55, 1.2, 0.09],
  ];
  branchSpecs.forEach((spec, i) => {
    const [from, yaw, pitch, len, r] = spec;
    const tip = addBranch(baker, from, yaw, pitch, len, r, DEAD_DARK, DEAD_PALE, seed + i * 2.7, 3);
    // Ramita secundaria en el extremo (bifurcación quebrada)
    if (i % 2 === 0) {
      addTube(
        baker,
        orientTo(tip, V(Math.cos(yaw + 1.1) * 0.7, 0.5, Math.sin(yaw + 1.1) * 0.7)),
        [{ r: r * 0.3, len: 0.45, tiltX: 0.3 }, { r: 0.02 }],
        4,
        () => DEAD_PALE,
        seed + i,
        0.2
      );
    }
  });

  // Muñones de ramas arrancadas
  for (let i = 0; i < 2; i++) {
    const yaw = 2.9 + i * 2.4;
    addTube(
      baker,
      mid
        .clone()
        .multiply(mTrans(0, -0.55 + i * 0.5, 0))
        .multiply(mRot(0, yaw, 0))
        .multiply(mRot(1.15, 0, 0)),
      [{ r: 0.11, len: 0.28 }, { r: 0.04 }],
      4,
      () => DEAD_DARK,
      seed + 30 + i,
      0.22
    );
  }

  return baker.build();
}

/** Zarza baja y retorcida: tallos leñosos + masa vegetal pegada al suelo. */
function buildBrambleTree(): THREE.BufferGeometry {
  const seed = 14.9;
  const baker = new FaceBaker(seed, 0.2);

  addRoots(baker, 4, 0.26, 0.42, BARK_DARK, seed);

  const stems: THREE.Vector3[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.8;
    const end = addTube(
      baker,
      orientTo(V(Math.cos(a) * 0.1, -0.1, Math.sin(a) * 0.1), V(Math.cos(a) * 0.34, 1, Math.sin(a) * 0.34)),
      [
        { r: 0.19, len: 0.34 },
        { r: 0.14, len: 0.32, tiltX: 0.3, tiltZ: 0.2 },
        { r: 0.08, len: 0.3, tiltX: 0.35, tiltZ: -0.25 },
        { r: 0.03 },
      ],
      5,
      (t) => BARK_DARK.clone().lerp(BARK_MID, t),
      seed + i * 2.1,
      0.16
    );
    stems.push(new THREE.Vector3().setFromMatrixPosition(end));
  }

  addLeafMass(baker, V(0, 0.72, 0), 0.86, seed, BUSH_LOW, BUSH_HIGH, {
    lat: 4,
    lon: 8,
    lobes: 4,
    squash: 0.6,
  });
  stems.forEach((s, i) => {
    addLeafMass(baker, s.clone().add(V(0, 0.1, 0)), 0.52, seed + i * 3.3, BUSH_LOW, BUSH_HIGH, {
      lat: 4,
      lon: 6,
      lobes: 3,
      squash: 0.58,
    });
  });

  return baker.build();
}

function buildTreeGeometry(kind: TreeKind): THREE.BufferGeometry {
  if (kind === "gnarled") return buildGnarledTree();
  if (kind === "dead") return buildDeadTree();
  return buildBrambleTree();
}

/* ------------------------------------------------------------------ */
/* Arbustos, troncos caídos y raíces expuestas                         */
/* ------------------------------------------------------------------ */

/** Arbusto: transición suelo → ramillas → masa de hojas. */
function buildBushGeometry(): THREE.BufferGeometry {
  const seed = 21.4;
  const baker = new FaceBaker(seed, 0.18);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    addTube(
      baker,
      orientTo(V(Math.cos(a) * 0.08, -0.12, Math.sin(a) * 0.08), V(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4)),
      [{ r: 0.09, len: 0.26 }, { r: 0.05, len: 0.2, tiltX: 0.3 }, { r: 0.02 }],
      4,
      () => BARK_DARK,
      seed + i,
      0.2
    );
  }
  addLeafMass(baker, V(0, 0.46, 0), 0.66, seed, BUSH_LOW, BUSH_HIGH, {
    lat: 4,
    lon: 8,
    lobes: 3,
    squash: 0.62,
  });
  addLeafMass(baker, V(0.3, 0.34, -0.16), 0.42, seed + 2.2, BUSH_LOW, BUSH_HIGH, {
    lat: 4,
    lon: 6,
    lobes: 2,
    squash: 0.6,
  });
  addLeafMass(baker, V(-0.26, 0.3, 0.22), 0.38, seed + 4.4, BUSH_LOW, BUSH_HIGH, {
    lat: 4,
    lon: 6,
    lobes: 3,
    squash: 0.58,
  });
  return baker.build();
}

/** Tronco caído: fuste curvado, corte astillado, ramas y tocón. */
function buildFallenLogGeometry(): THREE.BufferGeometry {
  const seed = 44.6;
  const baker = new FaceBaker(seed, 0.18);

  addTube(
    baker,
    orientTo(V(-0.9, 0.3, 0), V(1, 0.05, 0.12)),
    [
      { r: 0.32, len: 0.95 },
      { r: 0.29, len: 0.9, tiltX: 0.07, tiltZ: 0.1 },
      { r: 0.24, len: 0.85, tiltX: -0.05, tiltZ: 0.12 },
      { r: 0.16 },
    ],
    6,
    (t) => BARK_MID.clone().lerp(DEAD_PALE, t * 0.7),
    seed,
    0.14
  );
  // Ramas rotas sobre el fuste
  addTube(
    baker,
    orientTo(V(0.35, 0.42, 0.18), V(0.35, 0.75, 0.6)),
    [{ r: 0.09, len: 0.45, tiltX: 0.2 }, { r: 0.05, len: 0.3, tiltX: 0.35 }, { r: 0.02 }],
    4,
    () => DEAD_PALE,
    seed + 4,
    0.2
  );
  addTube(
    baker,
    orientTo(V(1.35, 0.36, -0.1), V(0.5, 0.4, -0.75)),
    [{ r: 0.07, len: 0.5 }, { r: 0.02 }],
    4,
    () => DEAD_DARK,
    seed + 6,
    0.2
  );
  // Tocón astillado del que se desgajó
  addTube(
    baker,
    mTrans(-1.35, -0.15, 0.3),
    [{ r: 0.34, len: 0.42 }, { r: 0.27, len: 0.3, tiltX: 0.15 }, { r: 0.12 }],
    6,
    (t) => BARK_DARK.clone().lerp(DEAD_PALE, t * 0.8),
    seed + 9,
    0.24
  );
  addRoots(baker, 4, 0.34, 0.4, BARK_DARK, seed + 12);
  return baker.build();
}

/** Raíces expuestas: arcos que entran y salen del terreno sobre un montículo. */
function buildRootsGeometry(): THREE.BufferGeometry {
  const seed = 57.3;
  const baker = new FaceBaker(seed, 0.18);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.6;
    addTube(
      baker,
      orientTo(V(Math.cos(a) * 0.5, -0.3, Math.sin(a) * 0.5), V(-Math.cos(a) * 0.25, 1, -Math.sin(a) * 0.25)),
      [
        { r: 0.13, len: 0.34 },
        { r: 0.12, len: 0.34, tiltX: 0.75 },
        { r: 0.1, len: 0.36, tiltX: 0.85 },
        { r: 0.07, len: 0.3, tiltX: 0.7 },
        { r: 0.03 },
      ],
      4,
      (t) => BARK_DARK.clone().lerp(SOIL, 0.2 + t * 0.25),
      seed + i * 2.9,
      0.18,
      false
    );
  }
  // Montículo de tierra removida (integra las raíces con el suelo)
  const mound = createRockGeometry(seed + 40, {
    sides: 7,
    height: 0.34,
    base: SOIL.clone().multiplyScalar(0.85),
    top: SOIL,
  });
  const pos = mound.getAttribute("position") as THREE.BufferAttribute;
  const col = mound.getAttribute("color") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 3) {
    v.fromBufferAttribute(pos, i);
    const a = v.clone().multiplyScalar(0.62);
    v.fromBufferAttribute(pos, i + 1);
    const b = v.clone().multiplyScalar(0.62);
    v.fromBufferAttribute(pos, i + 2);
    const d = v.clone().multiplyScalar(0.62);
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    baker.tri(a, b, d, c);
  }
  mound.dispose();
  return baker.build();
}

/* ------------------------------------------------------------------ */
/* Composición                                                         */
/* ------------------------------------------------------------------ */

const CLEARINGS = [
  { x: 0, z: 0, r: 5.2 },
  { x: 4.8, z: -7.2, r: 3.6 },
  { x: -3.4, z: 7.6, r: 3.4 },
];

const GROVES: Array<{ x: number; z: number; r: number; kinds: TreeKind[] }> = [
  { x: -7.2, z: -4.6, r: 2.9, kinds: ["gnarled", "bramble", "gnarled"] },
  { x: 6.8, z: 5.4, r: 2.7, kinds: ["dead", "gnarled", "dead"] },
  { x: 8.8, z: -2.6, r: 2.2, kinds: ["dead", "bramble"] },
  { x: -6.4, z: 7.8, r: 2.4, kinds: ["gnarled", "bramble"] },
];

const SOLITARY: Array<{ x: number; z: number; kind: TreeKind; scale: number }> = [
  { x: 1.2, z: 9.6, kind: "gnarled", scale: 1.35 },
  { x: -10.2, z: 0.8, kind: "dead", scale: 1.2 },
  { x: 2.6, z: 3.8, kind: "bramble", scale: 1 },
  { x: -1.8, z: -8.6, kind: "dead", scale: 0.95 },
];

const LOG_SPOTS = [
  { x: -5.0, z: -6.8, rot: 0.7 },
  { x: 7.4, z: 3.0, rot: 2.4 },
];
const ROOT_SPOTS = [
  { x: -6.0, z: -2.6 },
  { x: 5.6, z: 6.8 },
  { x: 9.4, z: -4.4 },
];
const DARK_STONE_CLUSTER = { x: -4.2, z: 3.6, r: 1.5, count: 5 };

type Instance = {
  x: number;
  z: number;
  y: number;
  rotY: number;
  tiltX: number;
  tiltZ: number;
  scale: number;
  tint: number;
};

function clearingClearance(x: number, z: number): number {
  let min = Infinity;
  for (const c of CLEARINGS) min = Math.min(min, Math.hypot(x - c.x, z - c.z) - c.r);
  return min;
}

function clampToIsland(x: number, z: number, margin: number): [number, number] {
  const theta = Math.atan2(z, x);
  const maxR = angularRadius(theta) * margin;
  const r = Math.hypot(x, z);
  if (r <= maxR) return [x, z];
  const k = maxR / (r || 1);
  return [x * k, z * k];
}

function slopeAt(x: number, z: number): number {
  const e = 0.5;
  const dx = surfaceHeight(x + e, z) - surfaceHeight(x - e, z);
  const dz = surfaceHeight(x, z + e) - surfaceHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

function makeInstance(
  x: number,
  z: number,
  rng: () => number,
  scale: number,
  tiltAmount: number,
  sink = 0.12
): Instance {
  return {
    x,
    z,
    y: surfaceHeight(x, z) - sink,
    rotY: rng() * Math.PI * 2,
    tiltX: (rng() - 0.5) * tiltAmount,
    tiltZ: (rng() - 0.5) * tiltAmount,
    scale,
    tint: 0.88 + rng() * 0.24,
  };
}

/* ------------------------------------------------------------------ */
/* Objeto público                                                      */
/* ------------------------------------------------------------------ */

export interface VegetationHandle {
  group: THREE.Group;
  dispose(): void;
}

export function createVegetation(): VegetationHandle {
  const group = new THREE.Group();
  group.name = "vegetation";
  const geometries: THREE.BufferGeometry[] = [];
  const rng = makeRng(20260222);

  const solidMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0,
  });
  const foliageMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const buildInstanced = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    instances: Instance[],
    name: string,
    castShadow = true
  ): void => {
    if (instances.length === 0) return;
    const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
    mesh.name = name;
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const color = new THREE.Color();
    instances.forEach((inst, i) => {
      euler.set(inst.tiltX, inst.rotY, inst.tiltZ, "YXZ");
      quat.setFromEuler(euler);
      pos.set(inst.x, inst.y, inst.z);
      scl.setScalar(inst.scale);
      matrix.compose(pos, quat, scl);
      mesh.setMatrixAt(i, matrix);
      color.setScalar(inst.tint);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  };

  /* ---------------- Árboles ---------------- */

  const treeInstances: Record<TreeKind, Instance[]> = { gnarled: [], dead: [], bramble: [] };
  const treePositions: Array<{ x: number; z: number }> = [];

  const addTree = (rawX: number, rawZ: number, kind: TreeKind, scale: number) => {
    const [x, z] = clampToIsland(rawX, rawZ, 0.8);
    if (slopeAt(x, z) > 1.2) return;
    for (const t of treePositions) {
      if (Math.hypot(t.x - x, t.z - z) < 1.9) return;
    }
    treePositions.push({ x, z });
    treeInstances[kind].push(makeInstance(x, z, rng, scale, 0.14, 0.22));
  };

  for (const grove of GROVES) {
    grove.kinds.forEach((kind, i) => {
      const a = (i / grove.kinds.length) * Math.PI * 2 + rng() * 1.1;
      const d = grove.r * (0.4 + rng() * 0.7);
      const scale =
        (kind === "bramble" ? 0.8 : 1) + rng() * (kind === "bramble" ? 0.3 : 0.4);
      addTree(grove.x + Math.cos(a) * d, grove.z + Math.sin(a) * d, kind, scale);
    });
  }
  for (const s of SOLITARY) addTree(s.x, s.z, s.kind, s.scale);

  const treeKinds: TreeKind[] = ["gnarled", "dead", "bramble"];
  for (const kind of treeKinds) {
    const geometry = buildTreeGeometry(kind);
    geometries.push(geometry);
    buildInstanced(geometry, solidMaterial, treeInstances[kind], `trees-${kind}`);
  }

  /* ---------------- Rocas decorativas ---------------- */

  const rockInstances: Instance[][] = [[], [], []];
  const rockAnchors: Array<{ x: number; z: number; n: number; spread: number }> = [
    { x: -7.2, z: -4.6, n: 2, spread: 3.4 },
    { x: 6.8, z: 5.4, n: 2, spread: 3.0 },
    { x: 8.8, z: -2.6, n: 3, spread: 2.6 },
    { x: -2.0, z: -6.4, n: 2, spread: 3.2 },
    { x: 3.6, z: 8.4, n: 2, spread: 2.8 },
    { x: -9.6, z: 3.2, n: 2, spread: 2.4 },
  ];
  for (let a = 0; a < rockAnchors.length; a++) {
    const anchor = rockAnchors[a];
    for (let i = 0; i < anchor.n; i++) {
      const ang = rng() * Math.PI * 2;
      const d = anchor.spread * (0.3 + rng() * 0.75);
      const [x, z] = clampToIsland(anchor.x + Math.cos(ang) * d, anchor.z + Math.sin(ang) * d, 0.9);
      if (clearingClearance(x, z) < -1.2) continue;
      rockInstances[(a + i) % 3].push(makeInstance(x, z, rng, 0.6 + rng() * 1.2, 0.26, 0.26));
    }
  }
  for (let i = 0; i < DARK_STONE_CLUSTER.count; i++) {
    const ang = (i / DARK_STONE_CLUSTER.count) * Math.PI * 2 + rng() * 0.6;
    const d = DARK_STONE_CLUSTER.r * (0.3 + rng() * 0.9);
    const [x, z] = clampToIsland(
      DARK_STONE_CLUSTER.x + Math.cos(ang) * d,
      DARK_STONE_CLUSTER.z + Math.sin(ang) * d,
      0.9
    );
    const inst = makeInstance(x, z, rng, 0.55 + rng() * 0.9, 0.3, 0.24);
    inst.tint = 0.52 + rng() * 0.12;
    rockInstances[i % 3].push(inst);
  }
  const rockVariants: Array<{ sides: number; height: number }> = [
    { sides: 6, height: 1.15 }, // bloque con cresta
    { sides: 5, height: 0.75 }, // losa baja
    { sides: 7, height: 1.5 }, // monolito puntiagudo
  ];
  for (let v = 0; v < rockVariants.length; v++) {
    const geometry = createRockGeometry(30.1 + v * 6.7, {
      sides: rockVariants[v].sides,
      height: rockVariants[v].height,
      base: ROCK_BASE,
      top: ROCK_TOP,
      moss: ROCK_MOSS,
    });
    geometries.push(geometry);
    buildInstanced(geometry, solidMaterial, rockInstances[v], `rocks-deco-${v}`);
  }

  /* ---------------- Troncos y raíces ---------------- */

  const logInstances: Instance[] = LOG_SPOTS.map((spot) => {
    const [x, z] = clampToIsland(spot.x, spot.z, 0.86);
    const inst = makeInstance(x, z, rng, 0.95 + rng() * 0.35, 0.08, 0.06);
    inst.rotY = spot.rot;
    return inst;
  });
  const logGeometry = buildFallenLogGeometry();
  geometries.push(logGeometry);
  buildInstanced(logGeometry, solidMaterial, logInstances, "fallen-logs");

  const rootInstances: Instance[] = ROOT_SPOTS.map((spot) => {
    const [x, z] = clampToIsland(spot.x, spot.z, 0.88);
    return makeInstance(x, z, rng, 0.9 + rng() * 0.5, 0.1, 0.06);
  });
  const rootsGeometry = buildRootsGeometry();
  geometries.push(rootsGeometry);
  buildInstanced(rootsGeometry, solidMaterial, rootInstances, "exposed-roots");

  /* ---------------- Vegetación baja ---------------- */

  const bushInstances: Instance[] = [];
  for (let i = 0; i < 60 && bushInstances.length < 14; i++) {
    const anchor =
      rng() < 0.75
        ? GROVES[Math.floor(rng() * GROVES.length)]
        : rockAnchors[Math.floor(rng() * rockAnchors.length)];
    const ang = rng() * Math.PI * 2;
    const d = 1.4 + rng() * 3.2;
    const [x, z] = clampToIsland(anchor.x + Math.cos(ang) * d, anchor.z + Math.sin(ang) * d, 0.9);
    if (clearingClearance(x, z) < -0.8) continue;
    if (slopeAt(x, z) > 1.4) continue;
    bushInstances.push(makeInstance(x, z, rng, 0.75 + rng() * 0.6, 0.18, 0.16));
  }
  const bushGeometry = buildBushGeometry();
  geometries.push(bushGeometry);
  buildInstanced(bushGeometry, solidMaterial, bushInstances, "bushes");

  // Menos hierba, mejor integrada: se agrupa en manchas, no dispersa uniforme
  const grassInstances: Instance[] = [];
  const dryInstances: Instance[] = [];
  const patches: Array<{ x: number; z: number; r: number; dry: boolean }> = [];
  for (let p = 0; p < 12; p++) {
    const ang = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * 11.5;
    patches.push({
      x: Math.cos(ang) * rad,
      z: Math.sin(ang) * rad,
      r: 1.4 + rng() * 2.2,
      dry: rng() < 0.3,
    });
  }
  for (const patch of patches) {
    const count = 4 + Math.floor(rng() * 7);
    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2;
      const d = patch.r * Math.sqrt(rng());
      const [x, z] = clampToIsland(patch.x + Math.cos(ang) * d, patch.z + Math.sin(ang) * d, 0.88);
      if (slopeAt(x, z) > 1.35) continue;
      const inst = makeInstance(x, z, rng, 0.85 + rng() * 0.75, 0.16, 0.05);
      if (patch.dry) dryInstances.push(inst);
      else grassInstances.push(inst);
    }
  }
  const grassGeometry = createBladeClusterGeometry(63.9, GRASS_BASE, GRASS_TIP, 6);
  const dryGeometry = createBladeClusterGeometry(71.2, DRY_BASE, DRY_TIP, 5);
  geometries.push(grassGeometry, dryGeometry);
  buildInstanced(grassGeometry, foliageMaterial, grassInstances, "grass-tufts", false);
  buildInstanced(dryGeometry, foliageMaterial, dryInstances, "dry-tufts", false);

  return {
    group,
    dispose(): void {
      group.traverse((obj) => {
        if (obj instanceof THREE.InstancedMesh) obj.dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      solidMaterial.dispose();
      foliageMaterial.dispose();
    },
  };
}
