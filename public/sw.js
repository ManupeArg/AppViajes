// Service worker mínimo: cachea el shell y los tiles del mapa para que la app
// abra rápido y el mapa se vea (parcialmente) sin señal. Los datos siempre van
// a Supabase en vivo.
const CACHE = "mapa-amigos-v1";
const TILE_HOSTS = ["tile.openstreetmap.org", "api.maptiler.com"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // Tiles del mapa: cache-first (cambian nunca)
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Estáticos de Next: stale-while-revalidate
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(e.request);
        const net = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; });
        return hit ?? net;
      }),
    );
  }
});
