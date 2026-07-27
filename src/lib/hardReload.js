/**
 * Clear every client-side cache and reload the freshest build.
 *
 * GitHub Pages serves hashed assets, but index.html and any registered service
 * worker / Cache Storage can pin an old bundle — which is why a just-deployed
 * fix (e.g. the fan-pivot render) can keep showing stale after a normal reload.
 * This nukes Cache Storage + service workers, then reloads with a cache-busting
 * query so index.html itself is refetched.
 */
export async function hardReload() {
  try {
    // 1. Cache Storage (PWA / drei asset caches, etc.)
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    // 2. any registered service workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    // best-effort — even if clearing fails, still force a fresh reload below
  }
  // 3. reload bypassing the HTTP cache. A cache-busting param guarantees a fresh
  // index.html without relying on the (non-standard) reload(true) forced flag.
  const url = new URL(window.location.href)
  url.searchParams.set('_', Date.now().toString())
  window.location.replace(url.toString())
}
