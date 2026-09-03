// Copia el worker de MapLibre a public/ para que Next/Turbopack no rompa su URL.
// Se corre solo en `npm install` (postinstall). Ver src/components/place-map.tsx.
import { copyFileSync, mkdirSync } from "node:fs";
const src = "node_modules/maplibre-gl/dist/";
const dst = "public/maplibre/";
mkdirSync(dst, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(src + f, dst + f);
console.log("maplibre worker copiado a public/maplibre/");
