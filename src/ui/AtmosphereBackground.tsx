import { useEffect, useRef } from "react";
import { BackgroundScene } from "../game/BackgroundScene";

/**
 * Fondo atmosférico de la pantalla de título.
 * Capas: paisaje gótico → tinte/frío → niebla → partículas Three.js → viñeta.
 */
export function AtmosphereBackground() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new BackgroundScene(host);
    return () => scene.dispose();
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Base */}
      <div className="absolute inset-0 bg-[#05070c]" />

      {/* Paisaje gótico con deriva lenta */}
      <img
        src="/images/bg-gothic.jpg"
        alt=""
        draggable={false}
        className="anim-bgdrift absolute inset-0 h-full w-full object-cover opacity-70"
      />

      {/* Tinte frío y oscurecimiento de bordes superior/inferior */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(5,7,12,0.82) 0%, rgba(5,7,12,0.22) 32%, rgba(6,9,15,0.34) 60%, rgba(3,5,9,0.95) 100%)",
        }}
      />
      <div className="absolute inset-0 bg-[#16233c] opacity-15 mix-blend-color" />

      {/* Resplandor alto-central (zona del título) */}
      <div
        className="absolute inset-0 mix-blend-soft-light"
        style={{
          background:
            "radial-gradient(58% 44% at 50% 24%, rgba(148,172,224,0.55), transparent 72%)",
        }}
      />

      {/* Niebla en movimiento */}
      <div className="mist mist-a" />
      <div className="mist mist-b" />

      {/* Partículas + luna (Three.js) */}
      <div ref={hostRef} className="absolute inset-0" />

      {/* Viñeta */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 92% at 50% 44%, transparent 52%, rgba(2,3,6,0.9) 100%)",
        }}
      />
    </div>
  );
}
