import * as THREE from "three";
import { hash2, smoothstep } from "../island/noise";
import { createLandFragmentGeometry } from "../shapes";

/**
 * VETH — Fase 2.1 · Cielo y atmósfera del Nivel 1
 *
 * Construye todo lo que rodea a la isla:
 *  · Cúpula de cielo con degradado (vertex colors) + resplandor del sol
 *    horneado en los vértices (técnica clásica de la época PS2).
 *  · Sol visible con halo (sprites) — estático.
 *  · Nubes estilizadas en 3 anillos (billboards con texturas generadas):
 *    bajo la isla, a media distancia y en el horizonte. Deriva muy lenta.
 *  · Capas de niebla-nube bajo la isla (planos horizontales).
 *  · Rocas flotantes lejanas que se integran con la niebla.
 *
 * Todo es sencillo: sin shaders propios, sin partículas masivas.
 */

/* ------------------------------------------------------------------ */
/* Constantes compartidas                                              */
/* ------------------------------------------------------------------ */

/** Color de niebla/horizonte: la niebla funde las nubes lejanas con el cielo. */
export const FOG_COLOR = 0x6f7d92;

const ZENITH = new THREE.Color(0x232f45);
const MID = new THREE.Color(0x475676);
const HORIZON = new THREE.Color(0x7c8798);
const BELOW = new THREE.Color(0x404a5c);
const SUN_GLOW = new THREE.Color(0xdcc79e);

/** Dirección del sol (también orienta la DirectionalLight de la escena). */
const SUN_DIR = new THREE.Vector3(-0.52, 0.42, -0.62).normalize();

const SKY_RADIUS = 800;

// Paleta coherente con la isla (src/game/island/Island.ts)
const ROCK_CLIFF = new THREE.Color(0x494338);
const ROCK_DEEP = new THREE.Color(0x2c2823);
const ROCK_DIRT_TOP = new THREE.Color(0x4e3b2c);
const ROCK_GRASS = new THREE.Color(0x3a4630);

/* ------------------------------------------------------------------ */
/* Cúpula de cielo                                                     */
/* ------------------------------------------------------------------ */

function buildSkyDome(): {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
} {
  const geometry = new THREE.SphereGeometry(SKY_RADIUS, 48, 28);
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const dir = new THREE.Vector3();
  const col = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const t = dir.y;

    if (t >= 0) {
      if (t < 0.16) col.copy(HORIZON).lerp(MID, smoothstep(0, 0.16, t));
      else col.copy(MID).lerp(ZENITH, Math.pow((t - 0.16) / 0.84, 0.8));
    } else {
      col.copy(HORIZON).lerp(BELOW, Math.pow(-t, 0.75));
    }

    // Resplandor cálido horneado alrededor del sol
    const d = Math.max(dir.dot(SUN_DIR), 0);
    col.lerp(SUN_GLOW, Math.pow(d, 5) * 0.5 + Math.pow(d, 1.6) * 0.12);

    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "sky-dome";
  mesh.frustumCulled = false;
  return { mesh, geometry, material };
}

/* ------------------------------------------------------------------ */
/* Texturas generadas (canvas)                                         */
/* ------------------------------------------------------------------ */

function createRadialTexture(
  stops: Array<[number, string]>,
  size = 128
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Nube estilizada: cúmulo de blobs elípticos con base suavizada. */
function createCloudTexture(variant: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");

  const blobs = 14 + variant * 4;
  for (let i = 0; i < blobs; i++) {
    const px = 42 + hash2(variant * 9.1 + 1.3, i * 3.7) * 172;
    const py = 128 + (hash2(i * 7.3 + 2.1, variant * 5.9) - 0.5) * 68;
    const rx = 24 + hash2(i * 2.9 + 0.7, variant * 7.7) * 34;
    const ry = rx * (0.38 + hash2(i * 4.1 + 3.3, variant * 3.3) * 0.26);

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, "rgba(255,255,255,0.72)");
    g.addColorStop(0.55, "rgba(255,255,255,0.26)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  // Bases suavizadas (fade inferior y superior)
  ctx.globalCompositeOperation = "destination-out";
  let fade = ctx.createLinearGradient(0, 150, 0, 256);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 150, 256, 106);
  fade = ctx.createLinearGradient(0, 0, 0, 64);
  fade.addColorStop(0, "rgba(0,0,0,0.4)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 256, 64);
  ctx.globalCompositeOperation = "source-over";

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* Nubes — anillos de billboards                                       */
/* ------------------------------------------------------------------ */

type CloudRingSpec = {
  count: number;
  rMin: number;
  rMax: number;
  yMin: number;
  yMax: number;
  sMin: number;
  sMax: number;
  tint: number;
  opacity: number;
  variant: number;
  speed: number;
};

const CLOUD_RINGS: CloudRingSpec[] = [
  // Volutas bajo la isla (crecen la sensación de abismo)
  {
    count: 6,
    rMin: 60,
    rMax: 150,
    yMin: -140,
    yMax: -60,
    sMin: 90,
    sMax: 170,
    tint: 0x93a0b0,
    opacity: 0.7,
    variant: 2,
    speed: 0.0028,
  },
  // Anillo principal a media distancia
  {
    count: 6,
    rMin: 170,
    rMax: 300,
    yMin: -40,
    yMax: 40,
    sMin: 140,
    sMax: 260,
    tint: 0xbcc6d2,
    opacity: 0.8,
    variant: 0,
    speed: -0.0022,
  },
  // Nubes enormes en el horizonte (fundidas por la niebla)
  {
    count: 5,
    rMin: 300,
    rMax: 400,
    yMin: -10,
    yMax: 110,
    sMin: 300,
    sMax: 430,
    tint: 0x9fabbc,
    opacity: 0.6,
    variant: 1,
    speed: 0.0015,
  },
];

/* ------------------------------------------------------------------ */
/* Rocas flotantes lejanas                                             */
/* ------------------------------------------------------------------ */

const ROCK_SPECS = [
  { seed: 1.7, pos: [52, 7, -34] as const, size: 3.4, phase: 0.3, bobSpeed: 0.28 },
  { seed: 4.2, pos: [-78, -12, 56] as const, size: 5.2, phase: 1.8, bobSpeed: 0.22 },
  { seed: 7.9, pos: [118, 18, 74] as const, size: 7.5, phase: 2.6, bobSpeed: 0.19 },
  { seed: 2.5, pos: [-56, 28, -88] as const, size: 4.1, phase: 4.1, bobSpeed: 0.31 },
  { seed: 9.3, pos: [34, -58, 108] as const, size: 6.2, phase: 5.0, bobSpeed: 0.17 },
  { seed: 5.6, pos: [-148, 34, -12] as const, size: 9.0, phase: 3.4, bobSpeed: 0.15 },
];

type RockRuntime = {
  mesh: THREE.Mesh;
  baseY: number;
  phase: number;
  bobSpeed: number;
  spin: number;
};

/**
 * Fragmento de terreno suspendido (revisión artística 2.2.1):
 * meseta superior terrosa, labio, flancos estratificados y base desgarrada
 * con colgantes. Silueta legible y sensación de masa, no un icosaedro.
 */
function buildRockGeometry(seed: number): THREE.BufferGeometry {
  return createLandFragmentGeometry(seed, {
    top: ROCK_DIRT_TOP.clone().lerp(ROCK_GRASS, 0.4),
    rock: ROCK_CLIFF,
    deep: ROCK_DEEP,
  });
}

/* ------------------------------------------------------------------ */
/* Objeto público                                                      */
/* ------------------------------------------------------------------ */

export interface SkyHandle {
  group: THREE.Group;
  sunDirection: THREE.Vector3;
  /** Animación mínima: deriva lenta de nubes, niebla y rocas. */
  update(dt: number, time: number): void;
  dispose(): void;
}

export function createSky(): SkyHandle {
  const group = new THREE.Group();
  group.name = "sky";
  const disposables: Array<{ dispose: () => void }> = [];

  // --- Cúpula ---
  const dome = buildSkyDome();
  group.add(dome.mesh);
  disposables.push(dome.geometry, dome.material);

  // --- Sol visible (estático) ---
  const sunCoreTexture = createRadialTexture([
    [0, "rgba(255,246,221,1)"],
    [0.4, "rgba(255,233,186,0.9)"],
    [0.7, "rgba(240,205,146,0.28)"],
    [1, "rgba(230,190,130,0)"],
  ]);
  const sunHaloTexture = createRadialTexture(
    [
      [0, "rgba(240,214,160,0.5)"],
      [0.45, "rgba(220,190,142,0.16)"],
      [1, "rgba(210,180,135,0)"],
    ],
    256
  );
  disposables.push(sunCoreTexture, sunHaloTexture);

  const sunPos = SUN_DIR.clone().multiplyScalar(620);
  const sunCore = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunCoreTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.95,
      fog: false,
    })
  );
  sunCore.position.copy(sunPos);
  sunCore.scale.setScalar(52);
  const sunHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sunHaloTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.55,
      fog: false,
    })
  );
  sunHalo.position.copy(sunPos);
  sunHalo.scale.setScalar(240);
  group.add(sunHalo, sunCore);
  disposables.push(sunCore.material, sunHalo.material);

  // --- Nubes (3 anillos, velocidades distintas) ---
  const ringGroups: Array<{ group: THREE.Group; speed: number }> = [];
  for (const spec of CLOUD_RINGS) {
    const ring = new THREE.Group();
    ring.name = `cloud-ring-${spec.variant}`;
    const texture = createCloudTexture(spec.variant);
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: spec.tint,
      transparent: true,
      opacity: spec.opacity,
      depthWrite: false,
    });
    disposables.push(texture, material);

    for (let i = 0; i < spec.count; i++) {
      const angle =
        (i / spec.count) * Math.PI * 2 + hash2(spec.variant + 3.7, i * 1.9) * 0.7;
      const radius =
        spec.rMin + hash2(i * 2.3 + 0.4, spec.variant + 8.8) * (spec.rMax - spec.rMin);
      const y = spec.yMin + hash2(i * 4.7 + 1.1, spec.variant + 2.2) * (spec.yMax - spec.yMin);
      const s = spec.sMin + hash2(i * 6.1 + 0.9, spec.variant + 5.5) * (spec.sMax - spec.sMin);
      const sprite = new THREE.Sprite(material);
      sprite.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      sprite.scale.set(s, s * 0.42, 1);
      ring.add(sprite);
    }
    group.add(ring);
    ringGroups.push({ group: ring, speed: spec.speed });
  }

  // --- Mar de niebla bajo la isla (planos horizontales) ---
  const mistTexture = createRadialTexture(
    [
      [0, "rgba(255,255,255,0.6)"],
      [0.55, "rgba(255,255,255,0.22)"],
      [1, "rgba(255,255,255,0)"],
    ],
    256
  );
  disposables.push(mistTexture);
  const mistGroup = new THREE.Group();
  mistGroup.name = "mist";
  const mistSpecs = [
    { scale: 560, y: -92, opacity: 0.34, tint: 0x93a3b8 },
    { scale: 720, y: -150, opacity: 0.22, tint: 0x8695ab },
  ];
  for (const m of mistSpecs) {
    const material = new THREE.MeshBasicMaterial({
      map: mistTexture,
      color: m.tint,
      transparent: true,
      opacity: m.opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    plane.rotation.x = -Math.PI / 2;
    plane.scale.set(m.scale, m.scale, 1);
    plane.position.y = m.y;
    mistGroup.add(plane);
    disposables.push(material, plane.geometry);
  }
  group.add(mistGroup);

  // --- Rocas flotantes ---
  const rockMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
    metalness: 0,
  });
  disposables.push(rockMaterial);
  const rocksGroup = new THREE.Group();
  rocksGroup.name = "floating-rocks";
  const rocks: RockRuntime[] = [];
  for (const spec of ROCK_SPECS) {
    const geometry = buildRockGeometry(spec.seed);
    disposables.push(geometry);
    const mesh = new THREE.Mesh(geometry, rockMaterial);
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    mesh.scale.setScalar(spec.size);
    // Inclinación contenida: los fragmentos conservan su cara superior
    mesh.rotation.set(
      (hash2(spec.seed, 1.1) - 0.5) * 0.5,
      hash2(spec.seed, 2.2) * Math.PI * 2,
      (hash2(spec.seed, 3.3) - 0.5) * 0.5
    );
    rocksGroup.add(mesh);
    rocks.push({
      mesh,
      baseY: spec.pos[1],
      phase: spec.phase,
      bobSpeed: spec.bobSpeed,
      spin: 0.01 + hash2(spec.seed, 4.4) * 0.014,
    });
  }
  group.add(rocksGroup);

  return {
    group,
    sunDirection: SUN_DIR.clone(),
    update(dt: number, time: number): void {
      // Deriva extremadamente lenta (vuelta completa en decenas de minutos)
      for (const ring of ringGroups) ring.group.rotation.y += dt * ring.speed;
      mistGroup.rotation.y += dt * 0.0011;
      rocksGroup.rotation.y += dt * 0.0032;
      for (const rock of rocks) {
        rock.mesh.position.y =
          rock.baseY + Math.sin(time * rock.bobSpeed + rock.phase) * 0.9;
        rock.mesh.rotation.y += dt * rock.spin;
      }
    },
    dispose(): void {
      for (const item of disposables) item.dispose();
    },
  };
}
