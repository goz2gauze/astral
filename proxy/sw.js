/*global Ultraviolet, UVServiceWorker*/
/*
 * Astral service worker.
 *
 * It lives at /proxy/sw.js, so its default scope is /proxy/ and the proxy
 * prefix below is always inside that scope. Paths are derived from this
 * script's URL, so the site also works from a subdirectory (GitHub Pages).
 */
importScripts("./uv/uv.bundle.js");

const root = new URL("./", self.location.href);

self.__uv$config = {
  prefix: root.pathname + "service/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: root.pathname + "uv/uv.handler.js",
  client: root.pathname + "uv/uv.client.js",
  bundle: root.pathname + "uv/uv.bundle.js",
  config: root.pathname + "uv/uv.config.js",
  sw: root.pathname + "uv/uv.sw.js",
};

importScripts(self.__uv$config.sw);

const uv = new UVServiceWorker();

self.addEventListener("fetch", (event) => {
  if (uv.route(event)) {
    event.respondWith(uv.fetch(event));
  }
});
