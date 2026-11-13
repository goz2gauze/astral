/*
 * In-app web proxy.
 *
 * The address bar sends URLs here; they load inside an iframe through
 * Ultraviolet (proxy/uv), which talks to a Wisp server over a libcurl
 * transport (proxy/libcurl). The Wisp server is not hard-coded: it is read
 * from config.js at the site root.
 */

import { config } from "./config.js";

const ROOT = new URL("./proxy/", document.baseURI);

export const proxy = {
  state: "idle", // idle | loading | ready | error
  error: "",
  wisp: "",
  prefix: new URL("service/", ROOT).pathname,
};

let initPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function normalizeWisp(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `wss://${raw}`;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  if (url.protocol === "https:") url.protocol = "wss:";
  else if (url.protocol === "http:") url.protocol = "ws:";
  else if (url.protocol !== "wss:" && url.protocol !== "ws:") return "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

function waitForActive(registration) {
  if (registration.active) return Promise.resolve(registration);
  const worker = registration.installing || registration.waiting;
  if (!worker) return Promise.resolve(registration);
  return new Promise((resolve) => {
    const check = () => {
      if (worker.state === "activated" || worker.state === "redundant") {
        worker.removeEventListener("statechange", check);
        resolve(registration);
      }
    };
    worker.addEventListener("statechange", check);
    check();
  });
}

async function bootProxy() {
  if (config.proxyEnabled === false) {
    proxy.state = "error";
    proxy.error = "the proxy is disabled in config.js";
    return proxy;
  }

  const wisp = normalizeWisp(config.wisp);
  proxy.wisp = wisp;
  if (!wisp) {
    proxy.state = "error";
    proxy.error = "no Wisp server set in config.js";
    return proxy;
  }

  proxy.state = "loading";
  try {
    if (!("serviceWorker" in navigator)) throw new Error("service workers are unavailable");

    const registration = await navigator.serviceWorker.register(new URL("sw.js", ROOT).pathname, {
      scope: ROOT.pathname,
    });
    await waitForActive(registration);
    await loadScript(new URL("uv/uv.bundle.js", ROOT).pathname);
    await loadScript(new URL("uv/uv.config.js", ROOT).pathname);

    const { BareMuxConnection } = await import(new URL("baremux/index.mjs", ROOT).href);
    const connection = new BareMuxConnection(new URL("baremux/worker.js", ROOT).pathname);
    await connection.setTransport(new URL("libcurl/index.mjs", ROOT).pathname, [{ wisp }]);

    proxy.state = "ready";
  } catch (error) {
    proxy.state = "error";
    proxy.error = error && error.message ? error.message : "the proxy failed to start";
  }
  return proxy;
}

export function ensureProxy() {
  if (!initPromise) initPromise = bootProxy();
  return initPromise;
}

/** Encode a real URL into the path the service worker serves. */
export function proxyUrl(url) {
  if (proxy.state !== "ready" || !window.__uv$config || !url) return "";
  try {
    return proxy.prefix + window.__uv$config.encodeUrl(url);
  } catch {
    return "";
  }
}

/** Turn an encoded path segment from a proxied page back into a real URL. */
export function decodeProxyUrl(encoded) {
  if (!window.__uv$config || !encoded) return "";
  try {
    return window.__uv$config.decodeUrl(encoded);
  } catch {
    return "";
  }
}
