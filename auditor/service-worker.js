'use strict';
/**
 * service-worker.js — Cache offline básico para la PWA de ContAPP Auditor.
 *
 * Estrategia: "network-first" para navegación (siempre intenta traer lo último,
 * cae al cache si no hay red) y "cache-first" para estáticos. Firebase y
 * mindicador.cl se dejan pasar siempre a la red.
 */
const CACHE = 'auditor-beta-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon.svg',
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Nunca cachear APIs externas ni Firebase
    if (url.origin !== self.location.origin) return;

    if (e.request.mode === 'navigate') {
        // network-first para el HTML
        e.respondWith(
            fetch(e.request).catch(() => caches.match('./index.html'))
        );
        return;
    }

    // cache-first para estáticos del propio origen
    e.respondWith(
        caches.match(e.request).then(hit => hit || fetch(e.request).then(resp => {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
            return resp;
        }).catch(() => hit))
    );
});
