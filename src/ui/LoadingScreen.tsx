/**
 * Pantalla temporal de carga (placeholder de la Fase 1).
 * Se muestra unos segundos tras pulsar START.
 */
export function LoadingScreen() {
  return (
    <main className="anim-fadein relative z-10 flex min-h-screen flex-col items-center justify-center bg-[#03040a]/88">
      <div className="flex items-center gap-5">
        <span className="loader-diamond" aria-hidden="true" />
        <span
          className="text-sm font-semibold uppercase text-[#8fa1c2]"
          style={{ letterSpacing: "0.5em", paddingLeft: "0.5em" }}
        >
          Loading<span className="loader-dots" />
        </span>
      </div>

      <div className="loader-track mt-8" aria-hidden="true" />

      <p
        className="hint mt-10 text-center leading-relaxed"
        style={{ textShadow: "0 1px 0 rgba(0,0,0,0.8)" }}
      >
        Más allá del umbral, el silencio responde
      </p>
    </main>
  );
}
