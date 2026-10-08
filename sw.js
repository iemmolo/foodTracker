const CACHE = "food-v1";
const APP_FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_FILES.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  const copy = res.clone();
  caches.open(CACHE).then(c => c.put(req, copy));
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname.includes("/plans/")) {
    e.respondWith(
      fetch(req, { cache: "no-cache" })
        .then(res => { if (res.ok) put(req, res); return res; })
        .catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") put(req, res);
      return res;
    }))
  );
});
