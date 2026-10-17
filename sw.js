// ACEIT service worker: lets the app open offline and load faster.
// App code is "network first" (always fresh when online, cached copy when offline).
// Lectures and pictures are "cache first, refresh in the background" so anything a student has opened works offline.
const VERSION = "aceit-v1";
const SHELL = ["./", "index.html", "css/style.css", "js/main.js", "js/ui.js", "js/store.js", "js/games.js", "js/srs.js", "config.js", "content/subjects.json", "content/manifest.json", "manifest.webmanifest"];

self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // never touch login or database calls
  const lazy = /\/(content|img|exams|icons)\//.test(url.pathname) && !/(subjects|manifest)\.json$/.test(url.pathname);
  if (lazy) {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  } else {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); if (r.ok) caches.open(VERSION).then((c) => c.put(req, copy)); return r; }).catch(() => caches.match(req).then((m) => m || caches.match("index.html"))));
  }
});
