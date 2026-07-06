'use strict';
const CACHE = 'pymes-beta-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icons/icon.svg'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    if (url.origin !== self.location.origin) return;
    if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).catch(() => caches.match('./index.html'))); return; }
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
        const copy = resp.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return resp;
    }).catch(() => hit)));
});
