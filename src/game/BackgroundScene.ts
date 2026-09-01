import * as THREE from "three";

/**
 * VETH — El Umbral Partido · Fase 1
 * Escena atmosférica para la pantalla de título.
 *
 * No es el mundo del juego: solo fondo ambiental
 * (luna velada, polvo en suspensión, ascuas y paralaje sutil).
 */

type ParticleLayer = {
  points: THREE.Points;
  baseX: Float32Array;
  phases: Float32Array;
  riseSpeed: number;
  swayAmount: number;
  swaySpeed: number;
  minY: number;
  maxY: number;
};

type LayerOptions = {
  count: number;
  size: number;
  opacity: number;
  color: number;
  spreadX: number;
  spreadY: number;
  offsetY?: number;
  depthMin: number;
  depthMax: number;
  riseSpeed: number;
  swayAmount: number;
  swaySpeed: number;
};

function createGlowTexture(
  stops: Array<[number, string]>,
  size = 64
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  );
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class BackgroundScene {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();
  private readonly layers: ParticleLayer[] = [];
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly mouse = { x: 0, y: 0 };
  private moon!: THREE.Sprite;
  private halo!: THREE.Sprite;
  private raf = 0;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
    this.camera.position.set(0, 0, 24);

    this.createMoon();
    this.createParticleLayers();
    this.handleResize();

    window.addEventListener("resize", this.handleResize);
    window.addEventListener("pointermove", this.handlePointer);

    this.raf = requestAnimationFrame(this.tick);
  }

  /** Luna pálida y su halo, detrás del título. */
  private createMoon(): void {
    const coreTexture = createGlowTexture(
      [
        [0, "rgba(242, 247, 255, 1)"],
        [0.5, "rgba(214, 225, 250, 0.9)"],
        [0.72, "rgba(165, 185, 232, 0.28)"],
        [1, "rgba(140, 160, 220, 0)"],
      ],
      256
    );
    const haloTexture = createGlowTexture(
      [
        [0, "rgba(150, 175, 235, 0.5)"],
        [0.45, "rgba(122, 147, 212, 0.16)"],
        [1, "rgba(110, 135, 200, 0)"],
      ],
      256
    );
    this.disposables.push(coreTexture, haloTexture);

    const coreMaterial = new THREE.SpriteMaterial({
      map: coreTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.9,
    });
    const haloMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.75,
    });
    this.disposables.push(coreMaterial, haloMaterial);

    this.moon = new THREE.Sprite(coreMaterial);
    this.moon.position.set(-8, 11.5, -48);
    this.moon.scale.setScalar(15);

    this.halo = new THREE.Sprite(haloMaterial);
    this.halo.position.copy(this.moon.position);
    this.halo.scale.setScalar(54);

    this.scene.add(this.halo, this.moon);
  }

  private createLayer(options: LayerOptions): void {
    const {
      count,
      size,
      opacity,
      color,
      spreadX,
      spreadY,
      offsetY = 0,
      depthMin,
      depthMax,
      riseSpeed,
      swayAmount,
      swaySpeed,
    } = options;

    const positions = new Float32Array(count * 3);
    const baseX = new Float32Array(count);
    const phases = new Float32Array(count);
    const minY = offsetY - spreadY / 2;
    const maxY = offsetY + spreadY / 2;

    for (let i = 0; i < count; i++) {
      baseX[i] = (Math.random() - 0.5) * spreadX;
      positions[i * 3] = baseX[i];
      positions[i * 3 + 1] = minY + Math.random() * spreadY;
      positions[i * 3 + 2] = -(depthMin + Math.random() * (depthMax - depthMin));
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size,
      map: this.dustTexture,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    this.scene.add(points);
    this.disposables.push(geometry, material);

    this.layers.push({
      points,
      baseX,
      phases,
      riseSpeed,
      swayAmount,
      swaySpeed,
      minY,
      maxY,
    });
  }

  private dustTexture!: THREE.CanvasTexture;

  private createParticleLayers(): void {
    this.dustTexture = createGlowTexture([
      [0, "rgba(255,255,255,1)"],
      [0.35, "rgba(215,228,255,0.6)"],
      [1, "rgba(160,180,255,0)"],
    ]);
    this.disposables.push(this.dustTexture);

    // Polvo lejano — denso, pequeño y lento
    this.createLayer({
      count: 340,
      size: 0.45,
      opacity: 0.34,
      color: 0x8fa3c8,
      spreadX: 96,
      spreadY: 48,
      depthMin: 10,
      depthMax: 46,
      riseSpeed: 0.32,
      swayAmount: 0.7,
      swaySpeed: 0.12,
    });

    // Polvo cercano — menos partículas, más grandes
    this.createLayer({
      count: 170,
      size: 0.85,
      opacity: 0.5,
      color: 0xb9c7e2,
      spreadX: 70,
      spreadY: 36,
      depthMin: 2,
      depthMax: 16,
      riseSpeed: 0.72,
      swayAmount: 1.05,
      swaySpeed: 0.2,
    });

    // Ascuas cálidas de las ruinas — muy sutil, cerca del suelo
    this.createLayer({
      count: 56,
      size: 0.6,
      opacity: 0.42,
      color: 0xd9a86e,
      spreadX: 76,
      spreadY: 15,
      offsetY: -9,
      depthMin: 6,
      depthMax: 26,
      riseSpeed: 1.05,
      swayAmount: 1.3,
      swaySpeed: 0.34,
    });
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private handlePointer = (event: PointerEvent): void => {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = (event.clientY / window.innerHeight) * 2 - 1;
  };

  private tick = (): void => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // Partículas: ascenso lento, vaivén lateral y reciclaje vertical
    for (const layer of this.layers) {
      const attribute = layer.points.geometry.getAttribute(
        "position"
      ) as THREE.BufferAttribute;
      const array = attribute.array as Float32Array;
      const count = layer.phases.length;
      for (let i = 0; i < count; i++) {
        const ix = i * 3;
        const iy = ix + 1;
        let y = array[iy] + layer.riseSpeed * dt;
        if (y > layer.maxY) y = layer.minY - Math.random() * 1.5;
        array[iy] = y;
        array[ix] =
          layer.baseX[i] +
          Math.sin(t * layer.swaySpeed + layer.phases[i]) * layer.swayAmount;
      }
      attribute.needsUpdate = true;
    }

    // Respiración de la luna
    const breathe = Math.sin(t * 0.42);
    this.halo.scale.setScalar(54 * (1 + breathe * 0.035));
    this.moon.scale.setScalar(15 * (1 + Math.sin(t * 0.55 + 1.3) * 0.02));

    // Paralaje sutil con el cursor + deriva autónoma
    const targetX = this.mouse.x * 1.7 + Math.sin(t * 0.05) * 0.5;
    const targetY = -this.mouse.y * 0.9 + Math.cos(t * 0.04) * 0.3;
    this.camera.position.x += (targetX - this.camera.position.x) * 0.03;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.03;
    this.camera.lookAt(0, 1, -20);

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("pointermove", this.handlePointer);
    for (const item of this.disposables) item.dispose();
    this.renderer.dispose();
    const canvas = this.renderer.domElement;
    if (canvas.parentNode === this.container) this.container.removeChild(canvas);
  }
}
