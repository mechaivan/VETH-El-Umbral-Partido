import { useEffect } from "react";
import { Ornament } from "./Ornament";

type TitleScreenProps = {
  onStart: () => void;
};

/**
 * Pantalla de título — VETH · EL UMBRAL PARTIDO
 * Estética de menú PS2: serif grabada, diamantes, brillos fríos.
 */
export function TitleScreen({ onStart }: TitleScreenProps) {
  // ENTER también pulsa START (los botones nativos ya gestionan su propio foco)
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.tagName === "BUTTON") return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onStart();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onStart]);

  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center">
      {/* Bloque de título */}
      <header className="mt-[8.5vh] flex flex-col items-center px-6 text-center">
        <p
          className="anim-rise hint"
          style={{ animationDelay: "150ms", textShadow: "0 1px 0 rgba(0,0,0,0.8)" }}
        >
          Un relato de fantasía oscura
        </p>

        <h1
          className="anim-rise relative mt-[2.5vh] select-none"
          style={{ animationDelay: "350ms" }}
        >
          <span className="title-metal block text-[clamp(4.2rem,15.5vw,12.5rem)] leading-none tracking-[0.07em]">
            VETH
          </span>
          <span
            aria-hidden="true"
            className="title-glint block text-[clamp(4.2rem,15.5vw,12.5rem)] leading-none tracking-[0.07em]"
          >
            VETH
          </span>
        </h1>

        <div
          className="anim-rise mt-[1.2vh] w-[min(480px,64vw)] text-[#8ba0c4]"
          style={{
            animationDelay: "700ms",
            filter: "drop-shadow(0 0 8px rgba(140,170,230,0.35))",
          }}
        >
          <Ornament className="h-7 w-full" />
        </div>

        <h2
          className="anim-rise mt-[1.6vh] text-[clamp(0.85rem,1.7vw,1.4rem)] font-medium uppercase text-[#a9b6d1]"
          style={{
            animationDelay: "950ms",
            letterSpacing: "0.5em",
            paddingLeft: "0.5em",
            textShadow:
              "0 0 14px rgba(120,150,210,0.45), 0 2px 0 rgba(0,0,0,0.85)",
          }}
        >
          El Umbral Partido
        </h2>
      </header>

      {/* Menú principal */}
      <nav
        className="anim-rise mt-auto mb-[13.5vh] flex flex-col items-center gap-5"
        style={{ animationDelay: "1500ms" }}
      >
        <button type="button" className="btn-menu" onClick={onStart} autoFocus>
          <span className="btn-label">Start</span>
        </button>
        <span className="hint" style={{ textShadow: "0 1px 0 rgba(0,0,0,0.8)" }}>
          Enter o click para cruzar
        </span>
      </nav>

      {/* Pie de pantalla */}
      <footer className="pointer-events-none absolute inset-x-8 bottom-6 flex items-end justify-between">
        <span className="hint">VETH · Build 0.1.0 — Fase 1</span>
        <span className="hint text-right">Proyecto en desarrollo</span>
      </footer>
    </main>
  );
}
