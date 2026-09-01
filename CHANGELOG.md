# CHANGELOG — VETH: El Umbral Partido

Registro de desarrollo por fases. Cada entrada documenta lo realmente
implementado y verificado en la fase correspondiente.

---

## [0.2.2.1] — Fase 2.2.1: Nivel 1 — Revisión artística y calidad visual

- **Fecha:** 2026 (quinta sesión de desarrollo)
- **Estado:** Completada y verificada
- **Compilación:** Correcta (`vite build` sin errores; `dist/index.html` ≈ 800,25 kB, gzip ≈ 218,47 kB)

### Problema visual detectado

Los assets del Nivel 1 se leían como **prototipo procedural**: casi todo estaba
construido con primitivas crudas —icosaedros deformados (rocas de superficie,
copas de árbol, arbustos, rocas flotantes), cilindros y conos sueltos (troncos,
ramas, raíces) y planos cruzados (hierba)—. El resultado parecía «low-poly
genérico sin texturas cargadas» en lugar de un escenario PS2 diseñado por
artistas. El terreno, además, tenía ondulación uniforme y un subsuelo cónico
demasiado regular.

### Elementos revisados y reemplazados

- **Nueva librería de formas diseñadas** `src/game/shapes.ts` (base de toda la
  revisión), con convención de caras verificada (normales hacia fuera):
  `FaceBaker` (horneado con color y matiz por cara), `makeRing`, `addTube`,
  `addLeafMass`, `createRockGeometry`, `createLandFragmentGeometry`,
  `createBladeClusterGeometry`, `orientTo` y `appendGeometry`.
- **Rocas (superficie y decorativas)** — *reemplazadas*: de icosaedros
  deformados a roca diseñada de ~30 caras: base ancha e irregular hundida en
  el suelo, hombro con planos grandes, cresta desplazada, **segunda punta** y
  **cleft** (grieta sugerida por geometría). 3 variantes: bloque con cresta,
  losa baja y monolito puntiagudo; tinte de musgo en las caras altas.
- **Rocas flotantes lejanas** — *reemplazadas*: ahora son **fragmentos de
  terreno** (`createLandFragmentGeometry`): meseta superior terrosa/verdosa,
  labio en voladizo, flancos estratificados y base desgarrada con **dos
  colgantes** de distinta longitud y punta desplazada. Se corrigió además su
  rotación (antes aleatoria en los 3 ejes, podían quedar invertidas): ahora
  giro libre en Y e inclinación contenida (±0,25 rad).
- **Troncos y ramas** — *reemplazados*: de cilindros/conos apilados a **tubos
  cónicos continuos** (`addTube`) que comparten anillo en cada articulación,
  con curvatura acumulada y punta afilada; desaparecen las tapas duras y los
  solapes que delataban las primitivas.
- **Raíces** — *reemplazadas*: nacen del propio tronco (arrancan dentro del
  radio del fuste) y se hunden en el terreno con giro descendente. Las raíces
  expuestas son ahora **arcos** que entran y salen del suelo sobre un
  **montículo de tierra removida**, en lugar de tubos apoyados encima.
- **Copas y arbustos** — *reemplazados*: de cúmulos de blobs separados a
  **masa vegetal cerrada y continua** (`addLeafMass`): elipsoide de baja
  resolución con lóbulos, ruido radial y base aplanada. Los árboles combinan
  masas muy solapadas que se leen como una sola silueta. Los arbustos añaden
  ramillas leñosas → transición **suelo → ramas → hojas**.
- **Hierba** — *reemplazada*: los planos cruzados dan paso a **hojas con
  volumen real** (prisma triangular curvado que se afila hasta la punta,
  ~9 triángulos por hoja, 5–6 hojas por mata, degradado base→punta).
- **Terreno de la isla** — *revisado, no sustituido*: se conserva el sistema
  procedural, el contorno irregular y `surfaceHeight(x, z)`, y se mejora:
  - **Domain warping** + **crestas rocosas** (ridged noise, suprimidas en el
    centro jugable) → volúmenes reconocibles en lugar de ondulación uniforme.
  - **Borde menos artificial**: la caída del labio varía por ángulo
    (`edgeProfile`).
  - **Transición césped → tierra → roca** por pendiente, altura y manchas de
    ruido, con césped reseco intermedio y oclusión suave por altura.
  - **Subsuelo rediseñado**: 6 niveles con **contrafuertes por sectores**
    (`undersideMass`), **colgantes de roca** de longitud variable
    (`spurLength`), bandas de **estrato** y punta más profunda y desplazada.
  - Malla algo más densa (48×12 superficie, 6 niveles) y matiz por cara más
    contenido para no ensuciar la lectura.
- **Composición** — *ajustada sin aumentar densidad*: menos objetos y mejor
  colocados. Árboles 14 → 13 con separación mínima mayor (1,5 → 1,9 u);
  arbustos 20 → 14; troncos caídos 3 → 2; piedras de superficie 9 → 8 ahora
  compuestas (pareja, afloramiento y guijarros); la hierba pasa de dispersión
  uniforme (176 matas) a **12 manchas agrupadas** (~60 matas).

### Elementos conservados

- Sistema procedural de la isla, `surfaceHeight(x, z)`, `angularRadius(theta)`,
  contorno irregular, base flotante y flotación de la isla.
- Toda la atmósfera de la Fase 2.1: cúpula de cielo, sol y halo, nubes,
  niebla, iluminación cálida/fría y sombras (sin reconstruir).
- Claros reservados, arboledas y anclajes de la composición de la Fase 2.2.
- Instancing, dos materiales para la vegetación, colocación determinista.
- START, LOADING, pantalla de título, CRT, tipografías, ornamentación, flujo
  de pantallas y cámara orbital: intactos.

### Archivos modificados

```
src/game/shapes.ts            → NUEVO (librería de formas low-poly artísticas)
src/game/island/Island.ts     → REVISADO (relieve, borde, color, subsuelo, piedras)
src/game/island/Vegetation.ts → REESCRITO sobre la nueva librería
src/game/sky/Sky.ts           → MODIFICADO (fragmentos de terreno + rotación)
CHANGELOG.md                  → ACTUALIZADO (esta entrada)
```

Sin cambios en `IslandScene.ts`, `IslandScreen.tsx`, `App.tsx`, CSS ni
`SETUP_AND_PLAY.txt` (la instalación y ejecución no varían).

### Problemas encontrados y corregidos

- **Normales invertidas** (riesgo alto al construir mallas a mano): se fijó y
  documentó una convención de winding y se derivó analíticamente para los tres
  casos usados (lateral entre anillos, ápice arriba, ápice abajo), aplicándola
  de forma centralizada en `FaceBaker`.
- **Rocas flotantes boca abajo**: al pasar de icosaedro (sin orientación) a
  fragmento con cara superior, la rotación aleatoria previa las volteaba;
  corregido limitando la inclinación.
- **TS6133/TS2304 en `Sky.ts`**: tras sustituir el generador de rocas, `fbm2`
  quedó sin uso y faltaban el import de `createLandFragmentGeometry` y un color
  de hierba; corregido.
- **Copas que seguían leyéndose como blobs**: resuelto solapando fuertemente
  pocas masas continuas en lugar de repartir muchas esferas pequeñas.
- **Riesgo de flotación de props** tras aumentar el relieve: se incrementaron
  los valores de hundimiento (`sink`) de árboles y rocas y se mantuvieron los
  filtros de pendiente.

### Decisiones técnicas

- **Diseño antes que polígonos**: el gasto se concentra en silueta (bases
  irregulares, crestas, cleft, colgantes) manteniendo cuentas bajas: roca ~30
  caras, mata de hierba ~54, árbol ~400.
- **Cero texturas nuevas**: todo se resuelve con geometría, vertex colors,
  matiz por cara y flat shading, como pedía la dirección artística.
- **Matiz por cara reducido** (±18 % en assets, ±7 % en terreno) para que el
  facetado no convierta cada objeto en un «cristal de roca».
- **Misma arquitectura técnica**: instancing, geometría compartida por
  arquetipo, 2 materiales en vegetación y 1 en la isla; el número de draw
  calls no aumenta pese a la mejora visual.
- **Determinismo intacto**: mismas semillas y PRNG, la isla se genera idéntica
  en cada ejecución.

### Resultado final

El escenario deja de leerse como prototipo: terreno con volúmenes y estratos,
acantilados con contrafuertes y colgantes, rocas con silueta intencionada,
árboles con masa vegetal continua y hierba con volumen, manteniendo la
atmósfera, el rendimiento y toda la funcionalidad previa. Fase 2.2.1
completada; pendiente de instrucciones para la Fase 2.3.

---

## [0.2.2] — Fase 2.2: Nivel 1 — Decoración y vegetación

- **Fecha:** 2026 (cuarta sesión de desarrollo)
- **Estado:** Completada y verificada
- **Compilación:** Correcta (`vite build` sin errores; `dist/index.html` ≈ 797,75 kB, gzip ≈ 217,38 kB)

### Objetivo de la fase

Poblar la isla del Nivel 1 con vegetación, rocas decorativas y primeros
elementos naturales de fantasía oscura, manteniendo la estética low-poly de
sexta generación y dejando zonas abiertas para el gameplay futuro. Sin
personaje ni jugabilidad.

### Elementos añadidos

- **3 arquetipos de árbol** horneados una sola vez y reutilizados por
  instancia (variación de escala, rotación e inclinación):
  - `gnarled` — árbol retorcido: tronco de 4 segmentos con inclinación
    acumulada (twist), 5 raíces expuestas en la base, 4 ramas angulosas
    quebradas y copa de 5 blobs icosaédricos facetados en verdes apagados.
  - `dead` — árbol muerto: tronco de 5 segmentos más alto y fino, 6 ramas
    secas sin copa, punta quebrada, madera grisácea.
  - `bramble` — arbolillo/zarza bajo y torcido: 3 segmentos, 3 ramas y
    3 blobs oscuros.
- **14 árboles colocados por composición** (tras filtros de pendiente y
  separación): 4 arboledas (oeste, sureste, este rocosa y norte) más
  4 ejemplares aislados, incluido un **árbol solitario destacado** (escala 1.3).
- **Vegetación baja**:
  - **Arbustos low-poly** (cúmulo de 4 blobs): hasta 20 instancias, siempre
    junto a arboledas o rocas, nunca en el centro de los claros.
  - **Matas de hierba** (3 hojas cruzadas afiladas, 6 triángulos por mata,
    degradado base→punta por vertex colors): 130 instancias.
  - **Hierba seca**: 46 instancias con paleta ocre apagada.
- **Rocas decorativas adicionales** (2 variantes: monolito simple y cúmulo de
  3–4 bloques): distribuidas en 6 anclajes junto a arboledas y zonas rocosas,
  con el mismo lenguaje visual y paleta que las 9 piedras de la Fase 2
  (que se conservan intactas).
- **Grupo de piedras oscuras** (5 unidades, `instanceColor` ≈ 0.5): pequeño
  conjunto natural que aporta identidad de fantasía oscura.
- **Troncos caídos y partidos** (3): 3 segmentos cilíndricos desalineados +
  muñón astillado + rama seca suelta.
- **Raíces expuestas** (3 grupos): arcos de 4 raíces emergiendo del suelo con
  un núcleo terroso.

### Elementos modificados

- `src/game/IslandScene.ts`: instancia `createVegetation()` y **añade su grupo
  como hijo de `island.group`**, de modo que la decoración hereda la flotación
  y la inclinación de la isla; se añade su liberación en `dispose()`.
  Ningún otro cambio en la escena.

### Elementos conservados intactos

- `src/game/island/Island.ts` (terreno procedural, `surfaceHeight(x, z)`,
  `angularRadius(theta)`, materiales y las 9 piedras originales): **sin tocar**.
- Cielo, sol, nubes, niebla, rocas flotantes e iluminación/sombras de la
  Fase 2.1: sin cambios.
- Cámara orbital temporal, START, LOADING, pantalla de título, CRT,
  tipografías y ornamentación: sin cambios.

### Archivos creados/modificados

```
src/game/island/Vegetation.ts → NUEVO (arquetipos, composición e instancing)
src/game/IslandScene.ts       → MODIFICADO (3 puntos: import, alta, dispose)
CHANGELOG.md                  → ACTUALIZADO (esta entrada)
```

`SETUP_AND_PLAY.txt` no requiere cambios (instalación, ejecución y compilación
no varían).

### Problemas encontrados y corregidos

- Error TS6133 por una constante de color (`STONE_BLACK`) declarada y no usada:
  las piedras oscuras se resolvieron finalmente con tinte por instancia
  (`instanceColor`) en lugar de una geometría propia; constante eliminada.
- Errores TS transitorios en `IslandScene.ts` entre ediciones consecutivas
  (import declarado antes de usarse, propiedad sin inicializar). El archivo
  final quedó consistente y la compilación es limpia.
- La vegetación inicialmente quedaría estática mientras la isla flota: se
  corrigió colgándola del grupo de la isla en lugar de añadirla a la escena.
- Riesgo de elementos colocados fuera del contorno irregular o en paredes:
  resuelto con `clampToIsland()` (sujeción al 80–90 % del radio angular real)
  y descarte por pendiente (`slopeAt()`).

### Decisiones técnicas

- **Instancing en todo**: 9 `InstancedMesh` (3 árboles, 2 rocas, arbustos,
  troncos, raíces, hierba y hierba seca) y **solo 2 materiales**
  (sólidos con `flatShading`; hierba con `DoubleSide`). Draw calls muy bajos.
- **Geometría horneada**: un `PartBaker` acumula primitivas (cilindros, conos,
  icosaedros) transformadas en una sola geometría con vertex colors y matiz
  por cara, reproduciendo el facetado hecho a mano de la época.
- **Variación por instancia** mediante escala, rotación, inclinación y
  `instanceColor` (±14 %), evitando modelos únicos por posición.
- **Composición autorizada, no aleatoria pura**: arboledas, anclajes rocosos y
  puntos de interés definidos a mano; la dispersión fina usa un PRNG
  determinista (LCG con semilla fija) → escenario idéntico en cada ejecución.
- **Claros reservados** (`CLEARINGS`): plaza central (r 5.2), mirador (r 3.6)
  y claro norte (r 3.4) quedan libres de árboles, arbustos y rocas; solo
  admiten hierba baja. Espacio garantizado para personaje, enemigos y combate.
- **Escala coherente**: árboles ≈ 3–6 u, arbustos ≈ 0,6–1,1 u, matas ≈ 0,4–0,6 u,
  rocas ≈ 0,5–1,8 u sobre una isla de ~30 u de diámetro (relación creíble para
  un humanoide de ~1,8 u).
- **Sombras**: árboles, rocas, troncos, raíces y arbustos proyectan y reciben;
  la hierba solo recibe (evita artefactos con `normalBias` y ahorra coste).

### Estado final

Fase 2.2 completada: la isla conserva su terreno, cielo y atmósfera previos y
ahora presenta arboledas retorcidas, árboles muertos, arbustos, hierba, hierba
seca, rocas adicionales, piedras oscuras, troncos caídos y raíces expuestas,
con lectura visual desde cualquier ángulo de la cámara orbital y amplias zonas
abiertas. Pendiente de instrucciones para la Fase 2.3.

---

## [0.2.1] — Fase 2.1: Nivel 1 — Cielo y atmósfera

- **Fecha:** 2026 (tercera sesión de desarrollo)
- **Estado:** Completada y verificada
- **Compilación:** Correcta (`vite build` sin errores; `dist/index.html` ≈ 783,22 kB, gzip ≈ 212,31 kB)

### Objetivo de la fase

Convertir el entorno de la isla en un escenario con cielo trabajado al estilo
de plataformas 3D de principios de los 2000 (PS2 + Dark Fantasy): cielo amplio
azul/grisáceo desaturado, sol visible con halo actuando como luz principal
(luz cálida vs. ambiente frío), nubes estilizadas, niebla de profundidad y
rocas flotantes integradas con la atmósfera. La isla de la Fase 2 se conserva
sin cambios en su geometría.

### Elementos añadidos

- **Cúpula de cielo** (esfera de radio 800, `BackSide`): degradado azul/pizarra
  horneado en **vertex colors** (horizonte claro `#7c8798` → medio `#475676` →
  cenit `#232f45`; mitad inferior `#404a5c`) y **resplandor cálido horneado
  alrededor del sol** (mezcla hacia `#dcc79e` según proximidad angular).
  Material básico sin niebla. Técnica clásica de la época PS2, sin shaders.
- **Sol visible**: par de sprites aditivos (núcleo `#fff6dd` escala 52 + halo
  escala 240, texturas radiales generadas por canvas) a 620 unidades en la
  dirección del sol. Estático.
- **Nubes estilizadas en 3 anillos** (17 billboards total), con texturas de
  nube generadas proceduralmente (14–22 blobs elípticos + fades vertical):
  - Anillo bajo la isla (6 nubes, 60–150 u, y −140…−60) — profundidad de abismo.
  - Anillo principal (6 nubes, 170–300 u, y −40…+40).
  - Anillo de horizonte (5 nubes enormes, 300–400 u) fundidas por la niebla.
  - Deriva **extremadamente lenta** por anillo (0.0015–0.0028 rad/s, sentidos
    alternos; vuelta completa en decenas de minutos).
- **Mar de niebla bajo la isla**: 2 planos horizontales grandes (560/720 u a
  y −92/−150, textura radial, opacidad 0.34/0.22) con rotación lentísima.
- **Rocas flotantes lejanas** (6 fragmentos): icosaedros deformados por ruido
  FBM (craggy, aplastados 0.72 en Y), vertex colors tierra/roca coherente con
  la isla, flat shading, un único material compartido; flotación senoidal
  (amplitud 0.9, fases distintas), giro individual muy lento y órbita global
  a 0.0032 rad/s. Las lejanas se integran con la niebla; las cercanas se ven
  con claridad.
- **Niebla de escena** `THREE.Fog` (70 → 520) con color exacto del horizonte
  (`#6f7d92`) para fundir nubes lejanas y rocas con el cielo sin ocultar la isla.
- **Iluminación renovada**:
  - `DirectionalLight` solar **cálida** (`#f2ddb2`, 1.9) **con sombras**
    (mapa 2048, orto-cámara ±32, bias −0.00015, normalBias 0.6, radio 2.5,
    `PCFShadowMap`) — sombras coherentes proyectadas sobre la isla.
  - Contraste frío: `HemisphereLight` (`#7b8bab`/`#2b2419`, 0.6) +
    `AmbientLight` (`#3a4661`, 0.3).

### Elementos modificados

- `src/game/IslandScene.ts`: reescrita la atmósfera provisional de la Fase 2
  (se eliminan el cielo nocturno, las estrellas y la luna sprite provisional);
  integra el módulo de cielo, la nueva iluminación, la niebla y las sombras.
  Renderer con `shadowMap.enabled` y clear color igual al horizonte.
  `far` de cámara ampliado a 1600 (cúpula de 800). La isla activa
  `castShadow`/`receiveShadow` recorriendo su grupo (sin tocar su geometría).
- La animación de la atmósfera se invoca desde el bucle principal
  (`sky.update(dt, time)`).

### Elementos conservados intactos

- Isla procedural, `surfaceHeight(x, z)`, materiales y flotación de la Fase 2.
- Las 9 piedras sobre la superficie de la Fase 2.
- Pantalla de título, START, LOADING, capas CRT, tipografías, ornamentación,
  navegación y `BackgroundScene.ts`.
- Cámara orbital temporal (rotar + zoom + auto-rotación en reposo).

### Archivos principales afectados

```
src/game/sky/Sky.ts          → NUEVO (cielo, sol, nubes, niebla, rocas)
src/game/IslandScene.ts      → REESCRITO (integración atmósfera + sombras)
CHANGELOG.md                 → ACTUALIZADO (esta entrada)
```

Sin cambios en: `src/game/island/Island.ts`, `IslandScreen.tsx`, `App.tsx`,
pantalla de título, CSS. `SETUP_AND_PLAY.txt` no requiere cambios (la forma
de instalar/ejecutar/compilar no varía).

### Problemas encontrados y corregidos

- Error TS2774 durante la escritura de `Sky.ts`: línea residual
  (`geometry.toNonIndexed ? ... : ...`) en un icosaedro (ya no indexado);
  eliminada y `let`→`const`. Compilación posterior limpia.
- Al integrar la niebla, se ajustó qué elementos la ignoran (`fog: false` en
  cúpula, sol y mar de niebla) para que el propio cielo no se niebe a sí
  mismo, y se limitaron los radios de los anillos de nubes (≤ 400 u) para que
  se fundan con la niebla sin desaparecer del todo.

### Decisiones técnicas relevantes

- **Estética PS2 por técnica, no por shader**: degradado del cielo por
  vertex colors horneados, nubes por billboards con texturas generadas en
  canvas, niebla lineal clásica. Sin shaders propios ni PBR.
- **Concepto de luz**: sol pálido ligeramente cálido sobre ambiente
  pizarra/azul — contraste cálido-frío deliberado para Dark Fantasy con
  suficiente luz para leer césped, tierra, roca y silueta.
- **Sombras reales solo de una luz y solo sobre la isla** (las rocas lejanas
  quedan fuera de la orto-cámara y no proyectan): coste mínimo.
- **Movimiento casi imperceptible**: cielo y sol estáticos; nubes, niebla y
  rocas con deriva de decenas de minutos por vuelta — escena tranquila pero viva.
- **Determinismo conservado**: posiciones de nubes y rocas derivan de `hash2`
  con semillas fijas (misma escena en cada ejecución).
- Sin personaje, controles WASD, salto, combate, HUD, ruinas, arquitectura,
  vegetación ni audio: alcance de la fase respetado.

### Estado final de la fase

Fase 2.1 completada: START y LOADING siguen funcionando; la isla aparece
suspendida en un cielo amplio azul/grisáceo con sol visible y halo, nubes a
varias distancias, niebla que da escala y profundidad, rocas flotantes
integradas y sombras solares coherentes sobre un terreno low-poly flat
shading. Pendiente de instrucciones para la Fase 2.2.

---

## [0.2.0] — Fase 2: Terreno base — Isla flotante

- **Fecha:** 2026 (segunda sesión de desarrollo)
- **Estado:** Completada y verificada
- **Compilación:** Correcta (`vite build` sin errores; `dist/index.html` ≈ 775,17 kB, gzip ≈ 209,53 kB). Verificado que el código del terreno queda incluido en el bundle.

### Objetivo de la fase

Sustituir la pantalla placeholder posterior a START por una escena 3D sencilla
que contenga **únicamente el terreno base de una isla flotante**, con estética
de plataformas 3D de principios de los 2000 (PS2 + dark fantasy). Sin gameplay,
sin personaje, sin decoración avanzada.

### Funcionalidades añadidas

- **Generador procedural de isla flotante** (`src/game/island/Island.ts`),
  determinista (misma isla en cada ejecución):
  - **Superficie superior** sobre una rejilla polar (44 segmentos angulares ×
    10 anillos + centro) con **contorno irregular** mediante FBM en coordenadas
    circulares (sin círculos perfectos ni siluetas geométricas simples).
  - **Pequeñas variaciones de altura**: ruido FBM (±~1) + cúpula central suave
    + descenso en el labio exterior.
  - **Laterales** que descienden en 5 anillos deformados (escala decreciente,
    torsión sutil de estratos, ruido radial y de profundidad) mostrando el
    fragmento de tierra desprendido.
  - **Base irregular y ligeramente puntiaguda**: terminada en una punta
    desplazada del eje (~8,4 unidades bajo el borde).
  - **Color por cara** (vertex colors sobre geometría no indexada, con matiz por
    cara del ±10 %): césped verde apagado con veteado, **manchas de tierra**
    (máscara de ruido), **manchas de roca** (ruido + pendiente calculada por
    diferencias finitas), labio exterior terroso y laterales tierra → roca →
    roca profunda.
  - **9 piedras sueltas** (icosaedros deformados, escalas/rotaciones
    pseudoaleatorias, apoyadas sobre la altura real del terreno), fusionadas en
    una sola geometría.
  - **Un único material** `MeshStandardMaterial` (vertexColors + flatShading,
    roughness 0.95, sin metal) compartido por terreno y piedras.
  - **Flotación suave** de la isla: balanceo vertical + inclinación leve.
  - Exportado `surfaceHeight(x, z)` para que fases futuras (personaje,
    colisiones) puedan muestrear la altura real del terreno.
- **Escena 3D de presentación** (`src/game/IslandScene.ts`):
  - Cielo nocturno sencillo (color base + niebla `THREE.Fog`).
  - 240 estrellas dispersas (points, sin niebla).
  - Luna lejana con halo aditivo (coherente con la pantalla de título).
  - Iluminación: hemisférica fría + direccional de luna + relleno cálido tenue
    para que la base no sea un recorte negro.
  - `ACESFilmicToneMapping` (exposición 1.05) para la paleta apagada.
- **Cámara orbital temporal** (`OrbitControls`):
  - Rotación con arrastre del ratón, zoom con rueda, paneo desactivado.
  - Límites de distancia (18–95) y de ángulo polar (0.3–2.8 rad: permite
    apreciar la base flotante desde abajo).
  - Inercia (damping 0.08), cursor `grab`/`grabbing`.
  - **Auto-rotación lenta** cuando el usuario no interactúa (se pausa al
    arrastrar y se reanuda tras 3,2 s en reposo).
- **Pantalla de la isla** (`src/ui/IslandScreen.tsx`): monta la escena 3D,
  UI mínima temporal con botón **VOLVER** (variante compacta `btn-menu--sm`),
  etiqueta de zona y leyenda de controles. Sin HUD de gameplay.
- **Flujo actualizado:** START → LOADING (~2,8 s) → ESCENA DE LA ISLA.
  El botón VOLVER devuelve al título.

### Cambios realizados

- `App.tsx`: estado `"placeholder"` → `"island"` en la máquina de pantallas;
  el temporizador de carga ahora lleva a la isla; `AtmosphereBackground` se
  desmonta al entrar en la isla (libera su renderer WebGL) y se vuelve a
  montar al regresar al título; import actualizado.
- `src/index.css`: añadida la variante `.btn-menu--sm` (botón de menú
  compacto) para la UI temporal de inspección. Sin cambios en estilos de la
  Fase 1.
- Eliminada `src/ui/PlaceholderScreen.tsx` (sustituida por la escena de la
  isla, como indica el objetivo de la fase).

### Archivos principales creados/modificados

```
src/game/island/noise.ts     → NUEVO (hash, value noise, FBM, smoothstep)
src/game/island/Island.ts    → NUEVO (generador de isla + piedras + flotación)
src/game/IslandScene.ts      → NUEVO (escena de presentación + cámara orbital)
src/ui/IslandScreen.tsx      → NUEVO (reemplaza al placeholder)
src/App.tsx                  → MODIFICADO (flujo title/loading/island)
src/index.css                → MODIFICADO (solo añade .btn-menu--sm)
src/ui/PlaceholderScreen.tsx → ELIMINADO
CHANGELOG.md                 → ACTUALIZADO (esta entrada)
```

Sin cambios en: pantalla de título, VETH, EL UMBRAL PARTIDO, START, LOADING,
capas CRT, tipografías, ornamentación ni `BackgroundScene.ts`.

### Problemas encontrados y corregidos

- Durante la edición secuencial de `App.tsx`, el linter reportó errores TS
  transitorios (import sin usar / comparación de tipos imposible) entre la
  primera y la última edición. Eran artefactos del estado intermedio; el
  archivo final quedó consistente y la compilación de producción es correcta.
- Se verificó analíticamente el sentido de las caras (winding) de la rejilla
  polar, los laterales y la punta para evitar normales invertidas antes de
  compilar.

### Decisiones técnicas relevantes

- **Isla estática y determinista**: se genera con ruido propio de semillas
  fijas, sin aleatoriedad en ejecución — la identidad de la zona 01 es fija y
  ampliable en fases futuras.
- **Geometría no indexada + `flatShading`**: facetado PS2 deliberado con
  color plano por triángulo; evita texturas y mantiene el look de época.
- **Muy poca geometría**: ~1.300 triángulos de terreno + 180 de piedras +
  ~800 de partículas puntuales; rendimiento sobrado.
- **Cámara de inspección, no de juego**: `OrbitControls` es temporal y se
  sustituirá por la cámara de gameplay en fases posteriores.
- **La escena de la isla es independiente del fondo del título** (cada una
  con su renderer; nunca activos a la vez) para no duplicar trabajo de GPU.
- **Alcance respetado:** sin personaje, controles WASD, salto, combate, HUD,
  ruinas, arquitectura, vegetación ni audio.

### Estado final de la fase

Fase 2 completada: START funciona, la pantalla de carga funciona, la escena 3D
aparece correctamente y la isla flotante muestra superficie de césped/tierra/
roca con variaciones de altura, silueta irregular y base que transmite
claramente que flota. Pendiente de instrucciones para la Fase 3.

---

## [0.1.0] — Fase 1: Proyecto base + Pantalla de título y menú principal

- **Fecha:** 2026 (sesión inicial de desarrollo del proyecto)
- **Estado:** Completada y verificada
- **Compilación:** Correcta (`vite build` sin errores; `dist/index.html` ≈ 738,72 kB, gzip ≈ 200,16 kB, en un único archivo vía `vite-plugin-singlefile`)

### Funcionalidades añadidas

- Configuración del proyecto base: **React 19 + TypeScript + Vite 7 + Tailwind CSS v4**.
- Instalación e integración de **Three.js** (con `@types/three`) y **lucide-react** (iconos).
- Máquina de estados de pantalla en `App.tsx` con tres estados:
  `title` → `loading` → `placeholder`.
- Menú principal funcional con un único botón **START**:
  - Al activarlo se muestra una **pantalla temporal de «LOADING...»** durante
    **2,8 segundos** (`LOADING_DURATION_MS = 2800`).
  - Después se muestra automáticamente una **pantalla placeholder** que indica
    que la Fase 1 está completada y que el gameplay llegará en fases posteriores.
  - La pantalla placeholder incluye el botón **VOLVER**, que regresa al título.
- Limpieza correcta de timers (`clearTimeout` al desmontar) y del renderer de
  Three.js (`dispose()` en el desmontaje del componente, seguro con StrictMode).

### Elementos visuales implementados

- **Fondo atmosférico en capas** (orden de apilado):
  1. Color base `#05070c`.
  2. Paisaje gótico pintado (`public/images/bg-gothic.jpg`, generado):
     catedral en ruinas, árboles muertos, niebla, paleta azul-grisácea fría;
     con animación de deriva lenta (`bgDrift`, 60 s, zoom 1.05 → 1.14).
  3. Degradado superior/inferior de oscurecimiento + tinte azul `#16233c`
     en modo `mix-blend-color`.
  4. Resplandor alto-central (`mix-blend-soft-light`) en la zona del título.
  5. Dos bancos de **niebla CSS** (`blur(42px)`) con movimiento horizontal
     alterno (38 s y 52 s).
  6. **Escena Three.js** (canvas con alpha, sin escenario 3D de juego):
     - Luna pálida con núcleo y halo aditivos con «respiración» (escala
       modulada por seno).
     - **566 partículas** en 3 capas con blending aditivo: polvo lejano
       (340, pequeñas, lentas), polvo cercano (170, mayores) y ascuas
       cálidas `0xd9a86e` (56, cerca del suelo).
     - Las partículas ascienden, oscilan lateralmente y se reciclan
       al salir de su rango vertical.
     - **Paralaje de cámara** con el cursor + deriva autónoma senoidal,
       con interpolación suavizada.
     - Pixel ratio limitado a 2; `dt` limitado a 0,05 s por frame.
  7. Viñeta radial oscura.
- **Título «VETH»**: fuente *Cinzel Decorative* 900, degradado metálico
  aplicado con `background-clip: text`, sombras grabadas frías y **barrido de
  brillo** periódico sobre los glifos (cada 8,5 s, inicio diferido 2,2 s).
- **Subtítulo «EL UMBRAL PARTIDO»** en *Cinzel* con `letter-spacing: 0.5em`.
- **Divisor ornamental SVG** (`Ornament.tsx`): líneas finas, púas y diamante
  central, reutilizado en el título y en la pantalla placeholder.
- **Botones de estilo años 2000** (clase `.btn-menu`): borde fino 1 px,
  fondo translúcido con degradado, `backdrop-filter`, pulsación de brillo
  sutil en reposo (`btnBreathe`, 3,4 s) y **diamantes laterales** que aparecen
  al pasar el cursor o al enfocar.
- **Capas CRT** por encima de todo (no bloquean clics, `pointer-events: none`):
  - *Scanlines* cada 3 px con parpadeo discreto.
  - *Grano de película* (SVG `feTurbulence` inline como data-URI) con
    desplazamiento a saltos (0,9 s, `steps(4)`).
- **Animaciones de entrada escalonadas** (`riseIn`: desplazamiento + blur)
  para leyenda, título, divisor, subtítulo y menú.
- **Pantalla de carga**: diamante giratorio, texto «LOADING» con puntos
  animados por CSS, barra indeterminada y cita ambiental.
- **Pantalla placeholder**: panel con doble marco (sombras inset
  superpuestas), icono `Castle` de Lucide, divisor ornamental, texto
  explicativo y botón VOLVER.
- **Favicon SVG** propio: diamante con degradado metálico sobre fondo oscuro.
- **Fuentes**: *Cinzel* (400–900) y *Cinzel Decorative* (400, 700, 900) vía
  Google Fonts, con fallback a serif del sistema.
- Textos de pie: `VETH · Build 0.1.0 — Fase 1` y `Proyecto en desarrollo`.
- Soporte de `prefers-reduced-motion`: desactiva las animaciones no esenciales.

### Interacciones implementadas

| Interacción | Resultado |
|---|---|
| Click en **START** | Pantalla «LOADING...» (~2,8 s) → pantalla placeholder |
| Tecla **Enter** / **Espacio** (en el título) | Igual que START (usa `onStart`; ignora eventos originados en botones para no duplicar) |
| Hover / foco sobre botones | Iluminación del borde, glow del texto, aparición de diamantes laterales, elevación de 1 px |
| Active sobre botones | Ligera compresión (`scale(0.985)`) |
| Click en **VOLVER** (placeholder) | Regresa a la pantalla de título |
| Mover el cursor | Paralaje sutil de la cámara de la escena de fondo |
| Botón START | Enfocado automáticamente al cargar (`autoFocus`) |
| Botón VOLVER | Enfocado automáticamente al entrar en el placeholder |

### Archivos creados o modificados

```
index.html                       → título «VETH — El Umbral Partido», fuentes,
                                  favicon, meta y fondo base anti-flash (MODIFICADO)
public/favicon.svg               → NUEVO
public/images/bg-gothic.jpg      → NUEVO (imagen generada, paisaje gótico)
src/index.css                    → tema Tailwind v4 (@theme con familias de
                                  fuentes) y todos los estilos góticos/CRT (REESCRITO)
src/App.tsx                      → máquina de estados de pantalla (REESCRITO)
src/vite-env.d.ts                → NUEVO (referencia a vite/client)
src/game/BackgroundScene.ts      → NUEVO (luna, partículas, paralaje, dispose)
src/ui/AtmosphereBackground.tsx  → NUEVO (capas de fondo + host de Three.js)
src/ui/Ornament.tsx              → NUEVO (divisor ornamental SVG)
src/ui/TitleScreen.tsx           → NUEVO (título + menú START)
src/ui/LoadingScreen.tsx         → NUEVO
src/ui/PlaceholderScreen.tsx     → NUEVO
CHANGELOG.md                     → NUEVO (este archivo)
package.json                     → solo dependencias añadidas vía npm install:
                                  three, @types/three, lucide-react
```

Archivos sin cambios: `src/main.tsx`, `src/utils/cn.ts`, `vite.config.ts`,
`tsconfig.json`.

### Decisiones técnicas y notas

- **Alcance respetado:** sin gameplay, personaje, físicas, colisiones, HUD,
  mundo 3D ni audio. La escena Three.js es únicamente ambiental.
- **Arquitectura simple y ampliable:** `src/game/` para código Three.js y
  `src/ui/` para la interfaz React; `App.tsx` actúa como máquina de estados
  mínima pensada para sustituirse/ampliarse en fases posteriores.
- **La escena de fondo no usa niebla de Three.js** (`THREE.Fog`), porque el
  canvas es transparente y la atmósfera ya la aportan la imagen y las capas
  CSS; las partículas se renderizan por encima de la imagen.
- **Texturas procedurales:** luna, halo y sprites de partícula son
  `CanvasTexture` generadas por gradientes radiales (sin assets extra).
- **Resoluciones objetivo:** 1920×1080, 1600×900 y 1280×720 (tipografía con
  `clamp()` y layout fluido). Sin optimización móvil en esta fase.
- **Audio:** no implementado (previsto para fases futuras).
- **Idioma de la UI:** español, salvo las etiquetas solicitadas en inglés
  (`START`, `LOADING`).
- **Control de versiones de pantalla:** los textos del pie identifican la
  build como `0.1.0 — Fase 1`.
- Ejecución en desarrollo: `npm run dev`; producción: `npm run build` +
  `npm run preview`.
