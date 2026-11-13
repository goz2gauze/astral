/*global Ultraviolet*/
/*
 * Ultraviolet client config.
 *
 * Loaded in the page (for URL encoding) and injected by the service worker
 * into every proxied document. All paths are resolved from this file's own
 * URL so they stay correct when the site is served from a subdirectory.
 */
(function () {
  const script = document.currentScript;
  const base = script && script.src ? new URL("../", script.src) : new URL("../", self.location.href);

  self.__uv$config = {
    prefix: new URL("service/", base).pathname,
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: new URL("uv/uv.handler.js", base).pathname,
    client: new URL("uv/uv.client.js", base).pathname,
    bundle: new URL("uv/uv.bundle.js", base).pathname,
    config: new URL("uv/uv.config.js", base).pathname,
    sw: new URL("uv/uv.sw.js", base).pathname,
  };
})();
