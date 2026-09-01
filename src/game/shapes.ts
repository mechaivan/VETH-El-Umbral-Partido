import * as THREE from "three";
import { fbm2, hash2 } from "./island/noise";

/**
 * VETH — Fase 2.2.1 · Librería de formas low-poly ARTÍSTICAS
 *
 * Sustituye el uso directo de primitivas (icosaedros, cilindros, conos,
 * planos cruzados) por constructores pensados en términos de
 * SILUETA → VOLUMEN → FORMA → COLOR → DETALLE.
 *
 * Todo se hornea en geometrías con vertex colors y matiz por cara, para
 * seguir usando flat shading, materiales compartidos e instancing.
 *
 * Convención de caras (normal hacia fuera, sentido antihorario):
 *  · lateral: quad(inferior_j, superior_j, superior_j+1, inferior_j+1)
 *  · tapa superior / punta hacia arriba: tri(anillo_j, ápice, anillo_j+1)
 *  · punta hacia abajo: tri(anillo_j, anillo_j+1, ápice)
 */

/* ------------------------------------------------------------------ */
/* Matrices                                                            */
/* ------------------------------------------------------------------ */

export const mTrans = (x: number, y: number, z: number): THREE.Matrix4 =>
  new THREE.Matrix4().makeTranslation(x, y, z);

export const mRot = (x: number, y: number, z: number): THREE.Matrix4 =>
  new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z, "YXZ"));

export const mScale = (x: number, y: number, z: number): THREE.Matrix4 =>
  new THREE.Matrix4().makeScale(x, y, z);

/** Matriz situada en `from` cuyo eje +Y apunta hacia `dir`. */
export function orientTo(from: THREE.Vector3, dir: THREE.Vector3): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
  return new THREE.Matrix4().compose(from.clone(), q, new THREE.Vector3(1, 1, 1));
}

/* ------------------------------------------------------------------ */
/* Horneado de caras                                                   */
/* ------------------------------------------------------------------ */

/** Acumula triángulos con color por cara en una única geometría. */
export class FaceBaker {
  private pos: number[] = [];
  private col: number[] = [];
  private faces = 0;

  constructor(
    private readonly tintSeed = 3.1,
    private readonly tintRange = 0.18
  ) {}

  private nextFactor(): number {
    return (
      1 -
      this.tintRange / 2 +
      hash2(this.tintSeed + this.faces * 0.618, this.faces * 1.37) * this.tintRange
    );
  }

  private push(
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    color: THREE.Color,
    factor: number
  ): void {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) {
      this.col.push(color.r * factor, color.g * factor, color.b * factor);
    }
    this.faces++;
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color): void {
    this.push(a, b, c, color, this.nextFactor());
  }

  /** Quad plano: ambos triángulos comparten matiz (evita ruido innecesario). */
  quad(
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    d: THREE.Vector3,
    color: THREE.Color
  ): void {
    const f = this.nextFactor();
    this.push(a, b, c, color, f);
    this.push(a, c, d, color, f);
  }

  /** Une dos anillos cerrados (inferior → superior). */
  bridge(
    lower: THREE.Vector3[],
    upper: THREE.Vector3[],
    color: THREE.Color | ((j: number) => THREE.Color)
  ): void {
    const n = Math.min(lower.length, upper.length);
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      const c = typeof color === "function" ? color(j) : color;
      this.quad(lower[j], upper[j], upper[k], lower[k], c);
    }
  }

  /** Cierra un anillo con un ápice situado por encima (o a su misma altura). */
  fanUp(ring: THREE.Vector3[], apex: THREE.Vector3, color: THREE.Color): void {
    for (let j = 0; j < ring.length; j++) {
      const k = (j + 1) % ring.length;
      this.tri(ring[j], apex, ring[k], color);
    }
  }

  /** Cierra un anillo con un ápice situado por debajo. */
  fanDown(ring: THREE.Vector3[], apex: THREE.Vector3, color: THREE.Color): void {
    for (let j = 0; j < ring.length; j++) {
      const k = (j + 1) % ring.length;
      this.tri(ring[j], ring[k], apex, color);
    }
  }

  get triangleCount(): number {
    return this.faces;
  }

  build(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    geometry.computeVertexNormals();
    return geometry;
  }
}

/** Copia una geometría transformada dentro de buffers acumuladores. */
export function appendGeometry(
  dstPos: number[],
  dstCol: number[],
  src: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  tint = 1
): void {
  const pos = src.getAttribute("position") as THREE.BufferAttribute;
  const col = src.getAttribute("color") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
    dstPos.push(v.x, v.y, v.z);
    dstCol.push(col.getX(i) * tint, col.getY(i) * tint, col.getZ(i) * tint);
  }
}

/* ------------------------------------------------------------------ */
/* Anillos y tubos                                                     */
/* ------------------------------------------------------------------ */

/** Anillo poligonal irregular transformado por `matrix`. */
export function makeRing(
  matrix: THREE.Matrix4,
  radius: number,
  sides: number,
  seed: number,
  jitter = 0.16
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const step = (Math.PI * 2) / sides;
  for (let j = 0; j < sides; j++) {
    const a = j * step + (hash2(seed + 1.3, j * 2.1) - 0.5) * step * 0.45;
    const r = radius * (1 - jitter / 2 + hash2(seed, j * 3.7) * jitter);
    pts.push(
      new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r).applyMatrix4(matrix)
    );
  }
  return pts;
}

export interface TubeNode {
  /** Radio del anillo en este nodo. */
  r: number;
  /** Longitud hasta el nodo siguiente. */
  len?: number;
  /** Inclinación aplicada en la articulación (antes de continuar). */
  tiltX?: number;
  tiltZ?: number;
}

/**
 * Tubo cónico continuo y curvable (troncos, ramas, raíces, leños).
 * Los tramos comparten anillo, por lo que las articulaciones no muestran
 * las tapas duras que delatan a un cilindro primitivo.
 * Devuelve la matriz del extremo.
 */
export function addTube(
  baker: FaceBaker,
  start: THREE.Matrix4,
  nodes: TubeNode[],
  sides: number,
  colorFor: (t: number) => THREE.Color,
  seed: number,
  jitter = 0.14,
  capTip = true
): THREE.Matrix4 {
  const cursor = start.clone();
  let lower = makeRing(cursor, nodes[0].r, sides, seed, jitter);

  for (let i = 1; i < nodes.length; i++) {
    cursor.multiply(mTrans(0, nodes[i - 1].len ?? 0, 0));
    cursor.multiply(mRot(nodes[i].tiltX ?? 0, 0, nodes[i].tiltZ ?? 0));
    const upper = makeRing(cursor, nodes[i].r, sides, seed + i * 1.7, jitter);
    const t = i / (nodes.length - 1);
    baker.bridge(lower, upper, colorFor(t));
    lower = upper;
  }

  if (capTip) {
    const last = nodes[nodes.length - 1];
    const apex = new THREE.Vector3(0, Math.max(last.r, 0.02) * 0.95, 0).applyMatrix4(
      cursor
    );
    baker.fanUp(lower, apex, colorFor(1));
  }
  return cursor;
}

/* ------------------------------------------------------------------ */
/* Rocas diseñadas                                                     */
/* ------------------------------------------------------------------ */

export interface RockOptions {
  sides?: number;
  height?: number;
  base?: THREE.Color;
  top?: THREE.Color;
  /** Tinte de musgo/tierra en las caras altas. */
  moss?: THREE.Color;
}

/**
 * Roca low-poly con silueta reconocible: base ancha e irregular, hombro
 * con planos grandes, cresta desplazada, una segunda punta y un cleft
 * (grieta sugerida por geometría). ~30 caras.
 */
export function createRockGeometry(seed: number, opts: RockOptions = {}): THREE.BufferGeometry {
  const sides = opts.sides ?? 6;
  const h = opts.height ?? 1;
  const baseColor = opts.base ?? new THREE.Color(0x4b4942);
  const topColor = opts.top ?? new THREE.Color(0x6f6c61);
  const baker = new FaceBaker(seed * 2.7, 0.16);

  const leanX = (hash2(seed, 1.1) - 0.5) * 0.5;
  const leanZ = (hash2(seed, 2.2) - 0.5) * 0.5;
  const notch = Math.floor(hash2(seed, 3.3) * sides) % sides;
  const peak = (notch + 2 + Math.floor(hash2(seed, 4.4) * (sides - 3))) % sides;

  // Ángulos compartidos por todos los anillos → caras grandes y coherentes
  const angles: number[] = [];
  const step = (Math.PI * 2) / sides;
  for (let j = 0; j < sides; j++) {
    angles.push(j * step + (hash2(seed + 7.7, j) - 0.5) * step * 0.5);
  }
  const ring = (
    y: number,
    radius: number,
    jitter: number,
    ox: number,
    oz: number,
    s: number
  ): THREE.Vector3[] =>
    angles.map((a, j) => {
      const r = radius * (1 - jitter / 2 + hash2(seed + s, j * 2.3) * jitter);
      return new THREE.Vector3(ox + Math.cos(a) * r, y, oz + Math.sin(a) * r);
    });

  const r0 = ring(0, 1, 0.36, 0, 0, 1);
  const r1 = ring(h * 0.38, 0.94, 0.3, leanX * 0.25, leanZ * 0.25, 2);
  const r2 = ring(h * 0.74, 0.56, 0.34, leanX * 0.6, leanZ * 0.6, 3);

  // Base irregular: algunos vértices se hunden en el terreno
  for (let j = 0; j < sides; j++) {
    r0[j].y -= hash2(seed + 9.1, j) * 0.22;
  }
  // Cleft: una arista entra hacia dentro sugiriendo grieta
  r1[notch].x *= 0.6;
  r1[notch].z *= 0.6;
  r2[notch].x *= 0.7;
  r2[notch].z *= 0.7;
  // Segunda punta y hombro caído en el lado opuesto
  r2[peak].y += h * 0.3;
  r1[(peak + 3) % sides].y -= h * 0.12;

  const apex = new THREE.Vector3(leanX * 0.95, h * 1.02, leanZ * 0.95);
  const midColor = baseColor.clone().lerp(topColor, 0.55);
  const crestColor = opts.moss ? topColor.clone().lerp(opts.moss, 0.35) : topColor;

  baker.bridge(r0, r1, baseColor);
  baker.bridge(r1, r2, midColor);
  baker.fanUp(r2, apex, crestColor);
  return baker.build();
}

/**
 * Fragmento de terreno suspendido: meseta superior con labio, flancos
 * rocosos estratificados y punta inferior con colgantes irregulares.
 * Pensado para las rocas flotantes lejanas (masa clara, silueta legible).
 */
export function createLandFragmentGeometry(
  seed: number,
  colors: { top: THREE.Color; rock: THREE.Color; deep: THREE.Color }
): THREE.BufferGeometry {
  const sides = 7;
  const baker = new FaceBaker(seed * 3.3, 0.16);
  const angles: number[] = [];
  const step = (Math.PI * 2) / sides;
  for (let j = 0; j < sides; j++) {
    angles.push(j * step + (hash2(seed + 4.9, j) - 0.5) * step * 0.5);
  }
  const ring = (
    y: number,
    radius: number,
    jitter: number,
    s: number,
    yJitter = 0
  ): THREE.Vector3[] =>
    angles.map((a, j) => {
      const r = radius * (1 - jitter / 2 + hash2(seed + s, j * 2.9) * jitter);
      const dy = yJitter * (hash2(seed + s + 0.5, j * 1.7) - 0.5);
      return new THREE.Vector3(Math.cos(a) * r, y + dy, Math.sin(a) * r);
    });

  const top = ring(0, 1, 0.26, 1, 0.16);
  const lip = ring(-0.26, 1.04, 0.24, 2);
  const flankA = ring(-0.95, 0.78, 0.3, 3, 0.22);
  const flankB = ring(-1.85, 0.48, 0.36, 4, 0.5);
  const flankC = ring(-2.6, 0.24, 0.4, 5, 0.55);

  // Colgantes: dos columnas descienden mucho más → base desgarrada
  const spurA = Math.floor(hash2(seed, 6.1) * sides) % sides;
  const spurB = (spurA + 3) % sides;
  flankB[spurA].y -= 0.65;
  flankC[spurA].y -= 0.95;
  flankB[spurB].y -= 0.32;
  flankC[spurB].y -= 0.5;

  const crown = new THREE.Vector3(0, 0.2, 0);
  const tip = new THREE.Vector3(
    (hash2(seed, 7.2) - 0.5) * 0.5,
    -3.35,
    (hash2(seed, 8.3) - 0.5) * 0.5
  );

  const midRock = colors.rock.clone().lerp(colors.deep, 0.4);
  baker.fanUp(top, crown, colors.top); // meseta
  baker.bridge(lip, top, colors.top.clone().lerp(colors.rock, 0.55)); // labio
  baker.bridge(flankA, lip, colors.rock);
  baker.bridge(flankB, flankA, midRock);
  baker.bridge(flankC, flankB, colors.deep);
  baker.fanDown(flankC, tip, colors.deep);
  return baker.build();
}

/* ------------------------------------------------------------------ */
/* Masa vegetal continua                                               */
/* ------------------------------------------------------------------ */

export interface LeafMassOptions {
  lat?: number;
  lon?: number;
  squash?: number;
  lobes?: number;
}

/**
 * Copa/arbusto como UNA masa cerrada y continua (no un montón de blobs):
 * elipsoide de baja resolución con lóbulos y ruido en el radio, base
 * aplanada para apoyarse sobre ramas o suelo.
 */
export function addLeafMass(
  baker: FaceBaker,
  center: THREE.Vector3,
  size: number,
  seed: number,
  colorLow: THREE.Color,
  colorHigh: THREE.Color,
  opts: LeafMassOptions = {}
): void {
  const nLat = opts.lat ?? 5;
  const nLon = opts.lon ?? 8;
  const squash = opts.squash ?? 0.78;
  const lobes = opts.lobes ?? 3;

  const rings: THREE.Vector3[][] = [];
  const heights: number[] = [];

  for (let i = 1; i < nLat; i++) {
    const phi = (i / nLat) * Math.PI;
    const cy = Math.cos(phi);
    const rr = Math.sin(phi);
    const ring: THREE.Vector3[] = [];
    for (let j = 0; j < nLon; j++) {
      const theta = (j / nLon) * Math.PI * 2;
      const lobe =
        1 +
        0.2 * Math.sin(lobes * theta + seed) +
        0.14 * Math.sin(2 * theta + phi * 2.6 + seed * 0.7);
      const n =
        0.86 +
        fbm2(Math.cos(theta) * 1.7 + seed, Math.sin(theta) * 1.7 + i * 2.1, 2) * 0.32;
      const r = size * rr * lobe * n;
      const y = center.y + cy * size * squash * (cy < 0 ? 0.72 : 1);
      ring.push(new THREE.Vector3(center.x + Math.cos(theta) * r, y, center.z + Math.sin(theta) * r));
    }
    rings.push(ring);
    heights.push(cy);
  }

  const colorAt = (cy: number) =>
    colorLow.clone().lerp(colorHigh, THREE.MathUtils.clamp(cy * 0.5 + 0.5, 0, 1));

  for (let i = 0; i < rings.length - 1; i++) {
    // rings[i] está más arriba que rings[i + 1]
    baker.bridge(rings[i + 1], rings[i], colorAt(heights[i]));
  }
  const apexTop = new THREE.Vector3(center.x, center.y + size * squash * 1.04, center.z);
  const apexBottom = new THREE.Vector3(
    center.x,
    center.y - size * squash * 0.72 * 1.02,
    center.z
  );
  baker.fanUp(rings[0], apexTop, colorHigh);
  baker.fanDown(rings[rings.length - 1], apexBottom, colorLow);
}

/* ------------------------------------------------------------------ */
/* Hierba con volumen                                                  */
/* ------------------------------------------------------------------ */

/**
 * Mata de hierba con VOLUMEN real: cada hoja es un prisma triangular
 * curvado que se afila hasta la punta (nada de planos cruzados).
 * ~9 triángulos por hoja.
 */
export function createBladeClusterGeometry(
  seed: number,
  colorBase: THREE.Color,
  colorTip: THREE.Color,
  blades = 5
): THREE.BufferGeometry {
  const baker = new FaceBaker(seed * 5.1, 0.14);

  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + hash2(seed, b * 1.7) * 1.1;
    const rootD = 0.05 + hash2(seed + 1, b) * 0.12;
    const cx = Math.cos(a) * rootD;
    const cz = Math.sin(a) * rootD;
    const h = 0.34 + hash2(seed + 2, b) * 0.32;
    const w = 0.05 + hash2(seed + 3, b) * 0.025;
    const curve = 0.14 + hash2(seed + 4, b) * 0.22;
    const dx = Math.cos(a) * curve;
    const dz = Math.sin(a) * curve;

    const section = (
      y: number,
      scale: number,
      ox: number,
      oz: number
    ): THREE.Vector3[] => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < 3; k++) {
        const ang = a + (k / 3) * Math.PI * 2;
        pts.push(
          new THREE.Vector3(
            cx + ox + Math.cos(ang) * w * scale,
            y,
            cz + oz + Math.sin(ang) * w * scale
          )
        );
      }
      return pts;
    };

    const base = section(0, 1, 0, 0);
    const mid = section(h * 0.55, 0.55, dx * 0.35, dz * 0.35);
    const tip = new THREE.Vector3(cx + dx, h, cz + dz);
    const cMid = colorBase.clone().lerp(colorTip, 0.5);

    baker.bridge(base, mid, colorBase);
    baker.fanUp(mid, tip, cMid.lerp(colorTip, 0.4));
  }

  return baker.build();
}
