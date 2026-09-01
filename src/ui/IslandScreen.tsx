import { useEffect, useRef } from "react";
import { IslandScene } from "../game/IslandScene";

type IslandScreenProps = {
  onBack: () => void;
};

/**
 * Escena de la isla flotante (Fase 2).
 * La capa 3D es solo terreno; la UI es mínima y temporal.
 */
export function IslandScreen({ onBack }: IslandScreenProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new IslandScene(host);
    return () => scene.dispose();
  }, []);

  return (
    <main className="anim-fadein relative z-10 h-full w-full">
      {/* Escena 3D */}
      <div ref={hostRef} className="absolute inset-0" />

      {/* UI temporal de inspección */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <header className="flex items-start justify-between px-8 pt-7">
          <div className="pointer-events-auto">
            <button type="button" className="btn-menu btn-menu--sm" onClick={onBack}>
              <span className="btn-label">Volver</span>
            </button>
          </div>
          <span
            className="hint pt-2 text-right"
            style={{ textShadow: "0 1px 0 rgba(0,0,0,0.85)" }}
          >
            Zona 01 · Isla del Umbral
          </span>
        </header>

        <footer className="mt-auto flex justify-center pb-8">
          <span
            className="hint"
            style={{ textShadow: "0 1px 0 rgba(0,0,0,0.85)" }}
          >
            Arrastrar · Rotar &nbsp;—&nbsp; Rueda · Zoom &nbsp;—&nbsp; La cámara
            orbita en reposo
          </span>
        </footer>
      </div>
    </main>
  );
}
