import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createIsland, type IslandHandle } from "./island/Island";
import { createVegetation, type VegetationHandle } from "./island/Vegetation";
import { createSky, FOG_COLOR, type SkyHandle } from "./sky/Sky";

/**
 * VETH — Fase 2.1 · Escena del Nivel 1 (isla flotante + cielo).
 *
 * Contiene:
 *  · Atmósfera del nivel (src/game/sky/Sky.ts): cúpula celeste, sol visible
 *    con halo, anillos de nubes, mar de niebla bajo la isla y rocas
 *    flotantes lejanas integradas con la niebla.
 *  · Iluminación: sol direccional ligeramente cálido (luz principal CON
 *    sombras) frente a un ambiente/hemisferio frío y oscuro (Dark Fantasy).
 *  · La isla procedural de la Fase 2 (sin cambios de geometría).
 *  · Cámara ORBITAL TEMPORAL (rotar + zoom, sin paneo) con auto-rotación
 *    en reposo.
 *
 * NO es la cámara definitiva del juego ni contiene gameplay.
 */

export class IslandScene {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly clock = new THREE.Clock();
  private readonly island: IslandHandle;
  private readonly vegetation: VegetationHandle;
  private readonly sky: SkyHandle;
  private time = 0;
  private raf = 0;
  private idleTimer: number | undefined;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;

    // Renderer (con sombras para la luz solar)
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(FOG_COLOR, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.cursor = "grab";
    container.appendChild(this.renderer.domElement);

    // Escena + niebla integrada con el horizonte del cielo
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(FOG_COLOR, 70, 520);

    // Cámara
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1600);
    this.camera.position.set(26, 14, 28);

    // Cielo + sol + nubes + niebla + rocas lejanas
    this.sky = createSky();
    this.scene.add(this.sky.group);

    // --- Iluminación ---
    // Sol: luz principal ligeramente cálida, proyecta sombras sobre la isla
    const sun = new THREE.DirectionalLight(0xf2ddb2, 1.9);
    sun.position.copy(this.sky.sunDirection).multiplyScalar(90);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.camera.near = 30;
    sun.shadow.camera.far = 170;
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.6;
    sun.shadow.radius = 2.5;
    this.scene.add(sun, sun.target);

    // Ambiente frío: hemisferio cielo/tierra + relleno tenue
    const hemi = new THREE.HemisphereLight(0x7b8bab, 0x2b2419, 0.6);
    const ambient = new THREE.AmbientLight(0x3a4661, 0.3);
    this.scene.add(hemi, ambient);

    // Isla (Fase 2, geometría intacta; solo activamos sombras)
    this.island = createIsland();
    this.island.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    // Decoración y vegetación (Fase 2.2): cuelga de la isla para heredar
    // su flotación. Sus sombras se configuran en el propio módulo.
    this.vegetation = createVegetation();
    this.island.group.add(this.vegetation.group);

    this.scene.add(this.island.group);

    // Cámara orbital temporal
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, -1.2, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.9;
    this.controls.enablePan = false;
    this.controls.minDistance = 18;
    this.controls.maxDistance = 95;
    this.controls.minPolarAngle = 0.3;
    this.controls.maxPolarAngle = 2.8; // permite mirar la base desde abajo
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = -0.55;
    this.controls.addEventListener("start", this.handleControlStart);
    this.controls.addEventListener("end", this.handleControlEnd);

    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    this.raf = requestAnimationFrame(this.tick);
  }

  private handleControlStart = (): void => {
    this.controls.autoRotate = false;
    this.renderer.domElement.style.cursor = "grabbing";
    if (this.idleTimer !== undefined) window.clearTimeout(this.idleTimer);
  };

  private handleControlEnd = (): void => {
    this.renderer.domElement.style.cursor = "grab";
    if (this.idleTimer !== undefined) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.controls.autoRotate = true;
    }, 3200);
  };

  private handleResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private tick = (): void => {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    this.island.update(this.time);
    this.sky.update(dt, this.time);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.idleTimer !== undefined) window.clearTimeout(this.idleTimer);
    window.removeEventListener("resize", this.handleResize);
    this.controls.removeEventListener("start", this.handleControlStart);
    this.controls.removeEventListener("end", this.handleControlEnd);
    this.controls.dispose();
    this.vegetation.dispose();
    this.island.dispose();
    this.sky.dispose();
    this.renderer.dispose();
    const canvas = this.renderer.domElement;
    if (canvas.parentNode === this.container) this.container.removeChild(canvas);
  }
}
