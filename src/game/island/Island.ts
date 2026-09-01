import * as THREE from "three";
import { fbm2, hash2, smoothstep } from "./noise";
import { appendGeometry, createRockGeometry, mRot, mScale, mTrans } from "../shapes";

/**
 * VETH — Fase 2 · Isla flotante (terreno base)
 * Revisión artística: Fase 2.2.1
 *
 * Se conserva el sistema procedural original (rejilla polar, contorno
 * irregular, `surfaceHeight`, base flotante) y se mejora su lectura visual:
 *
 *  · Relieve con domain warping + crestas rocosas (ridged noise) para que
 *    el terreno tenga volúmenes reconocibles y no ondulación uniforme.
 *  · Borde menos artificial: el labio exterior varía por ángulo.
 *  · Transición césped → tierra → roca por altura, pendiente y curvatura.
 *  · Subsuelo con contrafuertes por sectores, estratos y colgantes de roca:
 *    un fragmento arrancado del mundo, no un cono procedural.
 *  · Piedras de superficie rehechas con la roca diseñada de shapes.ts.
 */

/* ------------------------------------------------------------------ */
/* Parámetros                                                          */
/* ------------------------------------------------------------------ */

const ISLAND_RADIUS = 15;
const ANGULAR_SEGMENTS = 48;
const SURFACE_RINGS = 12;
const UNDERSIDE_LEVELS = 6;
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Paleta                                                              */
/* ------------------------------------------------------------------ */

const GRASS_DARK = new THREE.Color(0x36452e);
const GRASS_LIGHT = new THREE.Color(0x556740);
const GRASS_DRY = new THREE.Color(0x5f6541);
const DIRT_DARK = new THREE.Color(0x4c3b2a);
const DIRT_LIGHT = new THREE.Color(0x624d35);
const ROCK_DARK = new THREE.Color(0x4f4d46);
const ROCK_LIGHT = new THREE.Color(0x6c6959);
const CLIFF_DIRT = new THREE.Color(0x453425);
const CLIFF_ROCK = new THREE.Color(0x443f35);
const STRATA = new THREE.Color(0x554b3c);
const DEEP_ROCK = new THREE.Color(0x272420);

const tmpColor = new THREE.Color();

/* ------------------------------------------------------------------ */
/* Funciones espaciales                                                */
/* ------------------------------------------------------------------ */

/** Radio irregular del contorno en el ángulo θ. */
export function angularRadius(theta: number): number {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const low = fbm2(c * 1.8 + 7.3, s * 1.8 + 2.9, 3);
  const high = fbm2(c * 4.4 + 11.1, s * 4.4 + 5.2, 2);
  return ISLAND_RADIUS * (1 + (low - 0.5) * 0.34 + (high - 0.5) * 0.12);
}

/** Cuánto sobresale (o se hunde) el borde en ese ángulo: rompe el labio uniforme. */
function edgeProfile(theta: number): number {
  return fbm2(Math.cos(theta) * 2.6 + 51.7, Math.sin(theta) * 2.6 + 23.4, 2);
}

/** Masa del subsuelo por sector: contrafuertes y entrantes. */
function undersideMass(theta: number): number {
  return fbm2(Math.cos(theta) * 1.9 + 71.3, Math.sin(theta) * 1.9 + 65.8, 3);
}

/** Longitud extra de los colgantes de roca por sector. */
function spurLength(theta: number): number {
  return smoothstep(
    0.5,
    0.88,
    fbm2(Math.cos(theta) * 2.7 + 95.1, Math.sin(theta) * 2.7 + 12.6, 2)
  );
}

/**
 * Altura de la superficie en (x, z).
 * Ondulación deformada (domain warping) + crestas rocosas + cúpula suave
 * + caída del borde variable.
 */
export function surfaceHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  const R = angularRadius(theta);
  const f = r / R;

  // Domain warping: rompe la regularidad del ruido base
  const wx = x + (fbm2(x * 0.09 + 13.1, z * 0.09 + 4.4, 2) - 0.5) * 6;
  const wz = z + (fbm2(x * 0.09 + 21.7, z * 0.09 + 9.8, 2) - 0.5) * 6;

  const rolling = (fbm2(wx * 0.13 + 3.7, wz * 0.13 + 9.2, 4) - 0.5) * 2.3;

  // Crestas rocosas (ridged noise), suprimidas en el centro jugable
  const n = fbm2(wx * 0.1 + 31.4, wz * 0.1 + 17.2, 3);
  const ridge =
    Math.pow(1 - Math.abs(n * 2 - 1), 2.4) * 1.25 * smoothstep(0.18, 0.6, f);

  const dome = (1 - f * f) * 0.6;
  const edgeTuck = smoothstep(0.76, 1.0, f) * (0.45 + edgeProfile(theta) * 0.75);

  return rolling + ridge + dome - edgeTuck;
}

/** Pendiente local aproximada. */
function slopeAt(x: number, z: number): number {
  const e = 0.45;
  const dx = surfaceHeight(x + e, z) - surfaceHeight(x - e, z);
  const dz = surfaceHeight(x, z + e) - surfaceHeight(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

/* ------------------------------------------------------------------ */
/* Color del terreno                                                   */
/* ------------------------------------------------------------------ */

function writeColor(target: number[], color: THREE.Color): void {
  target.push(color.r, color.g, color.b);
}

/**
 * Césped → tierra → roca en función de pendiente, altura, curvatura y
 * manchas de ruido, con transiciones graduales (no manchas planas).
 */
function surfaceColor(x: number, z: number, y: number, out: THREE.Color): void {
  const r = Math.hypot(x, z);
  const theta = Math.atan2(z, x);
  const R = angularRadius(theta);
  const f = r / R;
  const slope = slopeAt(x, z);

  const grain = fbm2(x * 0.62 + 5.5, z * 0.62 + 1.2, 2);
  const dirtPatch = fbm2(x * 0.3 + 21.4, z * 0.3 + 17.8, 3);
  const rockPatch = fbm2(x * 0.24 + 33.1, z * 0.24 + 27.5, 3);

  // Base: césped con veteado y zonas resecas
  out.copy(GRASS_DARK).lerp(GRASS_LIGHT, grain);
  out.lerp(GRASS_DRY, smoothstep(0.62, 0.86, dirtPatch) * 0.35);

  // Tierra: hondonadas y senderos naturales
  tmpColor.copy(DIRT_DARK).lerp(DIRT_LIGHT, grain);
  const dirtMix = Math.max(
    smoothstep(0.58, 0.72, dirtPatch) * 0.9,
    smoothstep(0.55, 1.0, slope) * 0.7
  );
  out.lerp(tmpColor, dirtMix);

  // Roca: crestas y pendientes fuertes
  tmpColor.copy(ROCK_DARK).lerp(ROCK_LIGHT, grain * 0.8 + 0.1);
  const rockMix = Math.max(
    smoothstep(0.95, 1.5, slope),
    smoothstep(0.72, 0.84, rockPatch) * smoothstep(0.4, 1.1, y + 0.6)
  );
  out.lerp(tmpColor, rockMix);

  // Labio exterior: tierra que enlaza con los acantilados
  out.lerp(CLIFF_DIRT, smoothstep(0.72, 0.99, f) * 0.7);

  // Oclusión suave por altura (los valles quedan algo más oscuros)
  out.multiplyScalar(0.86 + THREE.MathUtils.clamp((y + 1.4) / 3.4, 0, 1) * 0.24);
}

/** Estratos del subsuelo: tierra arriba, roca y veta profunda abajo. */
function undersideColor(
  levelRatio: number,
  theta: number,
  levelIndex: number,
  out: THREE.Color
): void {
  out
    .copy(CLIFF_DIRT)
    .lerp(CLIFF_ROCK, smoothstep(0.08, 0.42, levelRatio))
    .lerp(DEEP_ROCK, Math.pow(levelRatio, 1.25));

  // Bandas de estrato horizontales (lectura de fragmento arrancado)
  const band = Math.sin(levelRatio * 9.5 + Math.cos(theta) * 0.8) * 0.5 + 0.5;
  out.lerp(STRATA, band * 0.16 * (1 - levelRatio));

  const mottle = fbm2(
    Math.cos(theta) * 3.1 + levelIndex * 7.7,
    Math.sin(theta) * 3.1 + levelIndex * 5.3,
    2
  );
  out.multiplyScalar(0.88 + mottle * 0.24);
}

/* ------------------------------------------------------------------ */
/* Geometría del terreno                                               */
/* ------------------------------------------------------------------ */

function buildTerrainGeometry(): THREE.BufferGeometry {
  const M = ANGULAR_SEGMENTS;
  const K = SURFACE_RINGS;
  const L = UNDERSIDE_LEVELS;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const boundaryY: number[] = new Array(M);
  const color = new THREE.Color();

  const vid = (i: number, j: number) => 1 + (i - 1) * M + (((j % M) + M) % M);
  const vidU = (l: number, j: number) => 1 + K * M + (l - 1) * M + (((j % M) + M) % M);
  const tipIndex = 1 + K * M + L * M;

  // Centro
  const centerY = surfaceHeight(0, 0);
  positions.push(0, centerY, 0);
  surfaceColor(0, 0, centerY, color);
  writeColor(colors, color);

  // Superficie: anillos con distribución no lineal (más densidad en el borde)
  for (let i = 1; i <= K; i++) {
    const f = Math.pow(i / K, 0.88);
    for (let j = 0; j < M; j++) {
      const jitter = i < K ? (hash2(i * 3.17, j * 7.71) - 0.5) * 0.05 : 0;
      const theta = (j / M) * TAU + jitter;
      const R = angularRadius(theta);
      const radiusNoise = i < K ? 1 + (hash2(i * 0.917, j * 0.732) - 0.5) * 0.07 : 1;
      const rr = f * R * radiusNoise;
      const x = Math.cos(theta) * rr;
      const z = Math.sin(theta) * rr;
      const y = surfaceHeight(x, z);
      positions.push(x, y, z);
      if (i === K) boundaryY[j] = y;

      surfaceColor(x, z, y, color);
      if (i === K) color.lerp(CLIFF_DIRT, 0.5);
      writeColor(colors, color);
    }
  }

  // Subsuelo: contrafuertes por sector, estratos y colgantes
  const scaleSchedule = [0.97, 0.9, 0.74, 0.55, 0.34, 0.16];
  const depthSchedule = [0.5, 1.35, 2.5, 3.9, 5.5, 7.2];
  for (let l = 1; l <= L; l++) {
    const t = l / L;
    for (let j = 0; j < M; j++) {
      const twist = t * 0.1;
      const theta = (j / M) * TAU + twist;
      const mass = undersideMass(theta);
      const detail = fbm2(
        Math.cos(theta) * 3.4 + l * 7.7,
        Math.sin(theta) * 3.4 + l * 3.3,
        2
      );

      // Radio: el sector con más masa mantiene grosor (contrafuerte)
      const massBoost = 1 + (mass - 0.5) * 0.55 * smoothstep(0.1, 0.85, t);
      const rr = Math.max(
        0.25,
        angularRadius(theta - twist) *
          scaleSchedule[l - 1] *
          massBoost *
          (1 + (detail - 0.5) * 0.22)
      );

      // Profundidad: colgantes de roca en algunos sectores
      const spur = spurLength(theta) * 3.2 * Math.pow(t, 1.4);
      const depth = depthSchedule[l - 1] + spur + (detail - 0.5) * 0.9;

      const x = Math.cos(theta) * rr;
      const z = Math.sin(theta) * rr;
      positions.push(x, boundaryY[j] - depth, z);

      undersideColor(t, theta, l, color);
      writeColor(colors, color);
    }
  }

  // Punta inferior desplazada
  const tipOffsetX = (fbm2(4.2, 9.9, 2) - 0.5) * 3.8;
  const tipOffsetZ = (fbm2(8.8, 2.4, 2) - 0.5) * 3.8;
  let minEdgeY = Infinity;
  for (let j = 0; j < M; j++) minEdgeY = Math.min(minEdgeY, boundaryY[j]);
  positions.push(tipOffsetX, minEdgeY - 11.6, tipOffsetZ);
  undersideColor(1, 0, L + 1, color);
  color.multiplyScalar(0.82);
  writeColor(colors, color);

  // Índices
  for (let j = 0; j < M; j++) indices.push(0, vid(1, j + 1), vid(1, j));
  for (let i = 1; i < K; i++) {
    for (let j = 0; j < M; j++) {
      const a = vid(i, j);
      const b = vid(i, j + 1);
      const c = vid(i + 1, j + 1);
      const d = vid(i + 1, j);
      indices.push(a, b, c, a, c, d);
    }
  }
  for (let l = 0; l < L; l++) {
    for (let j = 0; j < M; j++) {
      const a = l === 0 ? vid(K, j) : vidU(l, j);
      const d = l === 0 ? vid(K, j + 1) : vidU(l, j + 1);
      const b = vidU(l + 1, j);
      const c = vidU(l + 1, j + 1);
      indices.push(a, d, b, b, d, c);
    }
  }
  for (let j = 0; j < M; j++) indices.push(vidU(L, j), vidU(L, j + 1), tipIndex);

  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);

  geometry = geometry.toNonIndexed();
  jitterFaceColors(geometry);
  geometry.computeVertexNormals();
  return geometry;
}

/** Matiz por cara: acentúa el facetado sin ensuciar la lectura. */
function jitterFaceColors(geometry: THREE.BufferGeometry): void {
  const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;
  const faces = colorAttr.count / 3;
  for (let f = 0; f < faces; f++) {
    const factor = 0.93 + hash2(f * 0.618, 7.7) * 0.14;
    for (let v = 0; v < 3; v++) {
      const idx = f * 3 + v;
      colorAttr.setXYZ(
        idx,
        colorAttr.getX(idx) * factor,
        colorAttr.getY(idx) * factor,
        colorAttr.getZ(idx) * factor
      );
    }
  }
  colorAttr.needsUpdate = true;
}

/* ------------------------------------------------------------------ */
/* Piedras de superficie (rocas diseñadas)                             */
/* ------------------------------------------------------------------ */

/** Afloramientos rocosos repartidos por la isla, fundidos con el terreno. */
function buildStonesGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];

  // Composición: pareja junto al centro-oeste, afloramiento este,
  // guijarros sueltos en pendientes suaves.
  const stones: Array<{ x: number; z: number; s: number; h: number; sides: number }> = [
    { x: -3.6, z: -2.2, s: 1.35, h: 1.3, sides: 6 },
    { x: -2.6, z: -3.0, s: 0.85, h: 0.9, sides: 5 },
    { x: 9.6, z: 1.4, s: 1.7, h: 1.55, sides: 7 },
    { x: 8.4, z: 2.6, s: 1.0, h: 0.8, sides: 6 },
    { x: 0.9, z: 6.4, s: 1.15, h: 1.1, sides: 6 },
    { x: -8.4, z: -7.0, s: 1.5, h: 1.35, sides: 7 },
    { x: 4.4, z: -4.4, s: 0.7, h: 0.7, sides: 5 },
    { x: -10.6, z: 4.6, s: 1.05, h: 1.2, sides: 6 },
  ];

  stones.forEach((stone, i) => {
    const geometry = createRockGeometry(101.3 + i * 4.9, {
      sides: stone.sides,
      height: stone.h,
      base: ROCK_DARK.clone().lerp(CLIFF_ROCK, 0.35),
      top: ROCK_LIGHT,
      moss: GRASS_DARK,
    });
    const y = surfaceHeight(stone.x, stone.z) - stone.s * 0.22;
    const matrix = mTrans(stone.x, y, stone.z)
      .multiply(mRot((hash2(i, 1.3) - 0.5) * 0.24, hash2(i, 2.6) * TAU, (hash2(i, 3.9) - 0.5) * 0.24))
      .multiply(mScale(stone.s * (0.9 + hash2(i, 4.2) * 0.4), stone.s, stone.s * (0.9 + hash2(i, 5.5) * 0.4)));
    appendGeometry(positions, colors, geometry, matrix, 0.94 + hash2(i, 6.8) * 0.14);
    geometry.dispose();
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/* ------------------------------------------------------------------ */
/* Objeto público                                                      */
/* ------------------------------------------------------------------ */

export interface IslandHandle {
  group: THREE.Group;
  update(time: number): void;
  dispose(): void;
}

export function createIsland(): IslandHandle {
  const group = new THREE.Group();
  group.name = "island";

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0.0,
  });

  const terrainMesh = new THREE.Mesh(buildTerrainGeometry(), material);
  terrainMesh.name = "island-terrain";
  const stonesMesh = new THREE.Mesh(buildStonesGeometry(), material);
  stonesMesh.name = "island-stones";

  group.add(terrainMesh, stonesMesh);

  return {
    group,
    update(time: number): void {
      group.position.y = Math.sin(time * 0.45) * 0.25;
      group.rotation.z = Math.sin(time * 0.21) * 0.012;
      group.rotation.x = Math.cos(time * 0.27) * 0.012;
    },
    dispose(): void {
      terrainMesh.geometry.dispose();
      stonesMesh.geometry.dispose();
      material.dispose();
    },
  };
}
