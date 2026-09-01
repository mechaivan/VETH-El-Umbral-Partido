/**
 * Ruido determinista sin dependencias externas.
 * Se usa para generar la isla de forma procedural y ESTABLE:
 * con los mismos parámetros la isla es siempre idéntica.
 */

/** Hash pseudoaleatorio 2D → [0, 1). Determinista. */
export function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** Interpolación suave (smoothstep estándar). */
export function smooth01(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise 2D suave → [0, 1]. */
export function valueNoise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth01(x - xi);
  const yf = smooth01(y - yi);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** FBM (varias octavas de value noise) normalizado → ~[0, 1]. */
export function fbm2(x: number, y: number, octaves = 4): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/** Smoothstep clásico acotado a [0, 1]. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
