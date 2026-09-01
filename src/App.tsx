import { useCallback, useEffect, useState } from "react";
import { AtmosphereBackground } from "./ui/AtmosphereBackground";
import { TitleScreen } from "./ui/TitleScreen";
import { LoadingScreen } from "./ui/LoadingScreen";
import { IslandScreen } from "./ui/IslandScreen";

/**
 * VETH — El Umbral Partido · Fases 1 y 2
 *
 * Fase 1:
 *  · Fondo atmosférico (imagen gótica + niebla + partículas Three.js)
 *  · Pantalla de título con menú principal (START)
 *  · Pantalla temporal de carga
 * Fase 2:
 *  · Terreno base de la isla flotante (solo terreno + cámara orbital)
 */

type Screen = "title" | "loading" | "island";

const LOADING_DURATION_MS = 2800;

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");

  const handleStart = useCallback(() => setScreen("loading"), []);
  const handleBack = useCallback(() => setScreen("title"), []);

  // La carga temporal avanza automáticamente a la escena de la isla
  useEffect(() => {
    if (screen !== "loading") return;
    const timeout = window.setTimeout(
      () => setScreen("island"),
      LOADING_DURATION_MS
    );
    return () => window.clearTimeout(timeout);
  }, [screen]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#05070c] text-[#c6cfe0]">
      {/* Atmósfera del título (se desmonta al entrar en la isla) */}
      {screen !== "island" && <AtmosphereBackground />}

      {/* Pantallas */}
      {screen === "title" && <TitleScreen onStart={handleStart} />}
      {screen === "loading" && <LoadingScreen />}
      {screen === "island" && <IslandScreen onBack={handleBack} />}

      {/* Capas CRT por encima de todo (no bloquean clics) */}
      <div className="scanlines pointer-events-none fixed inset-0 z-40" />
      <div className="grain z-40" />
    </div>
  );
}
