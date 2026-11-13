import { icon, discordIcon } from "./icons.js";
import { config } from "./config.js";
import {
  ACCENTS,
  ENGINES,
  THEMES,
  applyPrefs,
  applyDisguise,
  clearLocalData,
  loadHistory,
  loadPrefs,
  loadUser,
  pushHistory,
  savePrefs,
  saveUser,
} from "./store.js";
import {
  renderAI,
  renderAccount,
  renderGames,
  renderLegal,
  renderMusic,
  renderNewTab,
  renderSettings,
} from "./pages.js";
import { decodeProxyUrl, ensureProxy, proxy, proxyUrl } from "./proxy.js";

/* ------------------------------------------------------------------ */
/* app state                                                           */
/* ------------------------------------------------------------------ */

const TITLES = {
  newtab: "New Tab",
  games: "Games",
  ai: "AI",
  music: "Music",
  account: "Account",
  legal: "Legal",
  settings: "Settings",
};

const ROUTE_ICONS = {
  newtab: "globe",
  games: "gamepad",
  ai: "bot",
  music: "music",
  account: "user",
  legal: "legal",
  settings: "settings",
};

let prefs = loadPrefs();
let user = loadUser();
let tabs = [];
let activeId = null;
let cleanups = [];
let tabSequence = 0;
let historyStack = [];
let historyIndex = -1;

const view = document.getElementById("view");
const tabsEl = document.getElementById("tabs");
const urlForm = document.getElementById("urlForm");
const urlInput = document.getElementById("urlInput");
const suggestionsEl = document.getElementById("urlSuggestions");
const engineIconEl = document.getElementById("engineIcon");
const engineMenu = document.getElementById("engineMenu");
const overlays = document.getElementById("overlays");
const toastRoot = document.getElementById("toastRoot");

applyPrefs(prefs);

/* ------------------------------------------------------------------ */
/* credit guard — the credit link is required for this build to run   */
/* ------------------------------------------------------------------ */

let siteBroken = false;
let creditObserver = null;
const CREDIT_TEXT = "recreated by goz!";
const CREDIT_HREF = /^https:\/\/discord\.(gg|com)\//i;

function creditIntact() {
  const link = document.querySelector("#siteCredit a[data-credit]");
  if (!link) return false;
  if (link.textContent.replace(/\s+/g, " ").trim().toLowerCase() !== CREDIT_TEXT) return false;
  return CREDIT_HREF.test(link.href);
}

function breakSite() {
  if (siteBroken) return;
  siteBroken = true;
  creditObserver?.disconnect();
  document.title = "Astral — integrity error";
  document.body.className = "credit-broken";
  document.body.innerHTML = `
    <div class="credit-error">
      <h1>Integrity check failed</h1>
      <p>The credit link at the bottom of this page was removed or changed, so this build will not run.</p>
      <p>Restore <code>recreated by goz!</code> in <code>index.html</code> (and its Discord URL in <code>js/config.js</code>) to bring the site back.</p>
      <code>ERR_CREDIT_MISSING</code>
    </div>`;
}

function startCreditGuard() {
  const link = document.querySelector("#siteCredit a[data-credit]");
  if (link) link.href = config.creditUrl;
  if (!creditIntact()) {
    breakSite();
    return;
  }
  creditObserver = new MutationObserver(() => {
    if (!creditIntact()) breakSite();
  });
  creditObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["href"],
  });
}

startCreditGuard();
if (siteBroken) throw new Error("Astral: credit link missing, refusing to start.");


/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const activeTab = () => tabs.find((tab) => tab.id === activeId) || tabs[0];

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  toastRoot.appendChild(node);
  setTimeout(() => {
    node.classList.add("leaving");
    setTimeout(() => node.remove(), 260);
  }, 2200);
}

function looksLikeUrl(value) {
  if (/^https?:\/\//i.test(value)) return true;
  if (/\s/.test(value)) return false;
  return /^[^\s.]+\.[a-z]{2,}([/:?#].*)?$/i.test(value);
}

function searchUrl(query) {
  const engine = ENGINES[prefs.engine] || ENGINES.duckduckgo;
  return `${engine.url}${encodeURIComponent(query)}`;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "") || "Web";
  } catch {
    return "Web";
  }
}

let proxyNoticeShown = false;

function notifyProxyUnavailable() {
  if (proxyNoticeShown) return;
  proxyNoticeShown = true;
  toast(proxy.state === "error" && proxy.error ? `Proxy unavailable: ${proxy.error}.` : "Proxy unavailable.");
}

function openExternal(url, query) {
  if (query) pushHistory(query);
  else pushHistory(url.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ------------------------------------------------------------------ */
/* tabs + routing                                                      */
/* ------------------------------------------------------------------ */

function createTab(route = "newtab", url = "") {
  const tab = {
    id: `tab-${++tabSequence}`,
    route,
    title: url ? hostOf(url) : TITLES[route] || "Tab",
    url,
  };
  tabs.push(tab);
  activeId = tab.id;
  return tab;
}

function trackHistory(route, url = "") {
  historyStack = historyStack.slice(0, historyIndex + 1);
  historyStack.push({ route, url });
  historyIndex = historyStack.length - 1;
}

function navigate(route, options = {}) {
  const tab = activeTab();
  if (!tab) return;
  tab.route = route;
  tab.title = TITLES[route] || "Tab";
  tab.url = "";
  if (!options.silent) trackHistory(route);
  renderActive();
}

/** Load a real URL inside the app through the proxy. */
function openProxied(url) {
  const tab = activeTab();
  if (tab && (tab.route === "web" || tab.route === "newtab")) {
    tab.route = "web";
    tab.url = url;
    tab.title = hostOf(url);
  } else {
    createTab("web", url);
  }
  trackHistory("web", url);
  pushHistory(url.replace(/^https?:\/\//, "").replace(/\/$/, ""));
  renderActive();
}

function activateTab(id) {
  if (id === activeId) return;
  activeId = id;
  renderActive();
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return;
  const node = tabsEl.querySelector(`[data-tab-id="${id}"]`);
  const finish = () => {
    tabs = tabs.filter((tab) => tab.id !== id);
    if (tabs.length === 0) createTab("newtab");
    if (activeId === id) activeId = tabs[Math.max(0, index - 1)].id;
    renderActive();
  };
  if (node) {
    node.classList.add("closing");
    setTimeout(finish, 210);
  } else {
    finish();
  }
}

function newTab(route = "newtab") {
  createTab(route);
  renderActive();
}

function renderTabs() {
  tabsEl.innerHTML = tabs
    .map(
      (tab) => `
      <div class="tab${tab.id === activeId ? " active" : ""}" data-tab-id="${tab.id}" role="tab" tabindex="0" aria-selected="${tab.id === activeId}">
        <span class="tab-favicon">${icon(ROUTE_ICONS[tab.route] || "globe")}</span>
        <span class="tab-title">${tab.title}</span>
        <button class="tab-close" type="button" data-close="${tab.id}" aria-label="Close ${tab.title}">${icon("x")}</button>
      </div>`,
    )
    .join("");

  tabsEl.querySelectorAll("[data-tab-id]").forEach((node) => {
    node.addEventListener("click", (event) => {
      if (event.target.closest("[data-close]")) return;
      activateTab(node.dataset.tabId);
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") activateTab(node.dataset.tabId);
    });
  });
  tabsEl.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTab(button.dataset.close);
    });
  });
}

/* ------------------------------------------------------------------ */
/* render                                                             */
/* ------------------------------------------------------------------ */

const ctx = {
  get prefs() {
    return prefs;
  },
  get user() {
    return user;
  },
  navigate,
  search,
  toast,
  rerender: () => renderActive(),
  onCleanup: (fn) => cleanups.push(fn),
  updatePrefs,
  setUser,
  resetAll,
  openAboutBlank,
};

function renderActive() {
  cleanups.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
  cleanups = [];

  const tab = activeTab();
  if (!tab) return;
  view.innerHTML = "";
  const container = document.createElement("div");
  container.className = "view-container";
  view.appendChild(container);

  switch (tab.route) {
    case "games":
      renderGames(container, ctx);
      break;
    case "ai":
      renderAI(container, ctx);
      break;
    case "music":
      renderMusic(container, ctx);
      break;
    case "account":
      renderAccount(container, ctx);
      break;
    case "legal":
      renderLegal(container, ctx);
      break;
    case "settings":
      renderSettings(container, ctx);
      break;
    case "web":
      renderProxyPage(container, tab);
      break;
    default:
      renderNewTab(container, ctx);
  }

  renderTabs();
  syncChrome();
  syncHistoryButtons();
}

function renderProxyPage(container, tab) {
  const url = tab.url || "";
  const src = proxyUrl(url);

  const wrap = document.createElement("div");
  wrap.className = "webview";

  const loading = document.createElement("div");
  loading.className = "webview-loading";
  const spinner = document.createElement("span");
  spinner.className = "webview-spinner";
  spinner.setAttribute("aria-hidden", "true");
  const status = document.createElement("p");
  status.className = "webview-status";
  status.textContent = `Loading ${hostOf(url)}…`;
  loading.append(spinner, status);
  wrap.appendChild(loading);

  if (!src) {
    loading.classList.add("webview-error");
    spinner.remove();
    status.textContent = proxy.error || "The proxy is not available.";
    container.appendChild(wrap);
    return;
  }

  const frame = document.createElement("iframe");
  frame.className = "web-frame";
  frame.title = hostOf(url);
  frame.referrerPolicy = "no-referrer";
  frame.src = src;
  wrap.appendChild(frame);
  container.appendChild(wrap);

  const slowTimer = setTimeout(() => {
    if (!loading.classList.contains("hidden")) status.textContent = `Still loading ${hostOf(url)}…`;
  }, 12000);

  frame.addEventListener("load", () => {
    clearTimeout(slowTimer);
    loading.classList.add("hidden");
    try {
      const frameWindow = frame.contentWindow;
      if (frameWindow && frameWindow.location.pathname.startsWith(proxy.prefix)) {
        const real = decodeProxyUrl(frameWindow.location.pathname.slice(proxy.prefix.length));
        if (real) {
          tab.url = real;
          tab.title = hostOf(real);
        }
      }
      const pageTitle = frame.contentDocument && frame.contentDocument.title;
      if (pageTitle) tab.title = pageTitle;
    } catch {
      /* the page is not readable yet; keep the tab title we have */
    }
    renderTabs();
    syncChrome();
  });

  cleanups.push(() => clearTimeout(slowTimer));
}

function syncChrome() {
  const tab = activeTab();
  const route = tab ? tab.route : "newtab";

  urlInput.value = route === "newtab" ? "" : route === "web" ? tab.url || "" : `astral://${route}`;
  const engine = ENGINES[prefs.engine] || ENGINES.duckduckgo;
  urlInput.placeholder = `Search ${engine.name} or type a URL`;
  engineIconEl.innerHTML = icon(engine.icon);

  renderEngineMenu();

  document.querySelectorAll("#menuMain button, #menuSecondary button").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });

  const sidebarOpen = prefs.sidebarOpen !== false;
  document.getElementById("chrome").classList.toggle("sidebar-collapsed", !sidebarOpen);
  document.body.classList.toggle("sidebar-collapsed", !sidebarOpen);
  const sidebarButton = document.getElementById("sidebarToggle");
  sidebarButton.textContent = sidebarOpen ? "‹" : "›";
  sidebarButton.setAttribute("aria-expanded", String(sidebarOpen));

  if (prefs.disguise === "none") {
    document.title = route === "newtab" ? "Astral" : `${tab.title} — Astral`;
  }
}

/* ------------------------------------------------------------------ */
/* preferences + account                                              */
/* ------------------------------------------------------------------ */

function updatePrefs(patch) {
  prefs = { ...prefs, ...patch };
  savePrefs(prefs);
  applyPrefs(prefs);
  renderActive();
}

function setUser(nextUser) {
  user = nextUser;
  saveUser(user);
  renderActive();
}

function resetAll() {
  clearLocalData();
  prefs = loadPrefs();
  user = null;
  applyPrefs(prefs);
  tabs = [];
  createTab("newtab");
  renderActive();
  toast("Local data cleared.");
}

function openAboutBlank() {
  window.open(window.location.href, "_blank", "noopener");
  setTimeout(() => window.location.replace("about:blank"), 150);
}

/* ------------------------------------------------------------------ */
/* address bar + search                                               */
/* ------------------------------------------------------------------ */

function search(value) {
  const query = value.trim();
  if (!query) return;
  if (query.startsWith("astral://")) {
    const route = query.replace("astral://", "").replace(/\/$/, "") || "newtab";
    if (TITLES[route]) {
      navigate(route);
      return;
    }
  }
  const target = looksLikeUrl(query)
    ? /^https?:\/\//i.test(query)
      ? query
      : `https://${query}`
    : searchUrl(query);

  if (proxy.state === "ready") {
    openProxied(target);
    return;
  }
  if (proxy.state === "loading") {
    toast("The proxy is still starting — try again in a moment.");
    return;
  }
  notifyProxyUnavailable();
  if (looksLikeUrl(query)) openExternal(target);
  else openExternal(target, query);
}

function renderSuggestions() {
  const value = urlInput.value.trim();
  if (!value) {
    suggestionsEl.hidden = true;
    return;
  }
  const engine = ENGINES[prefs.engine] || ENGINES.duckduckgo;
  const rows = [];

  if (value.startsWith("astral://")) {
    Object.entries(TITLES)
      .filter(([route]) => route !== "game" && `astral://${route}`.includes(value.toLowerCase()))
      .slice(0, 5)
      .forEach(([route]) => {
        rows.push({ label: `astral://${route}`, tag: "Astral", action: () => navigate(route) });
      });
  } else {
    loadHistory()
      .filter((item) => item.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 3)
      .forEach((item) => {
        rows.push({ label: item, tag: "History", action: () => search(item) });
      });
    rows.push({ label: `Search ${engine.name} for “${value}”`, tag: "Search", action: () => search(value) });
    if (looksLikeUrl(value)) {
      rows.push({ label: `Open ${value}`, tag: "URL", action: () => search(value) });
    }
  }

  suggestionsEl.innerHTML = rows
    .map(
      (row, index) => `
      <button class="urlbar-suggestion" type="button" data-suggestion="${index}">
        ${icon("search")}<span>${row.label.replace(/</g, "&lt;")}</span><em>${row.tag}</em>
      </button>`,
    )
    .join("");
  suggestionsEl.hidden = rows.length === 0;
  suggestionsEl.querySelectorAll("[data-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows[Number(button.dataset.suggestion)];
      suggestionsEl.hidden = true;
      urlInput.blur();
      row.action();
    });
  });
}

function renderEngineMenu() {
  engineMenu.innerHTML = Object.entries(ENGINES)
    .map(
      ([key, engine]) =>
        `<button type="button" data-engine="${key}" class="${key === prefs.engine ? "active" : ""}">${icon(engine.icon)}${engine.name}</button>`,
    )
    .join("");
  engineMenu.querySelectorAll("[data-engine]").forEach((button) => {
    button.addEventListener("click", () => {
      engineMenu.hidden = true;
      updatePrefs({ engine: button.dataset.engine });
    });
  });
}

document.getElementById("engineBtn").addEventListener("click", (event) => {
  event.stopPropagation();
  engineMenu.hidden = !engineMenu.hidden;
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("#engineWrap")) engineMenu.hidden = true;
  if (!event.target.closest("#urlForm")) suggestionsEl.hidden = true;
});

urlInput.addEventListener("input", renderSuggestions);
urlInput.addEventListener("focus", renderSuggestions);

urlForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = urlInput.value.trim();
  suggestionsEl.hidden = true;
  if (!value) return;
  if (value.startsWith("astral://")) {
    search(value);
    urlInput.value = "";
    return;
  }
  search(value);
  urlInput.value = "";
});

/* ------------------------------------------------------------------ */
/* navigation chrome                                                  */
/* ------------------------------------------------------------------ */

document.getElementById("menuNewTab").innerHTML = `${icon("plus")}<span>New Tab</span>`;
document.getElementById("menuNewTab").addEventListener("click", () => newTab("newtab"));

const sidebarToggle = document.getElementById("sidebarToggle");
sidebarToggle.textContent = prefs.sidebarOpen === false ? "›" : "‹";
sidebarToggle.addEventListener("click", () => updatePrefs({ sidebarOpen: !prefs.sidebarOpen }));

document.getElementById("themeBtn").innerHTML = icon(prefs.colorScheme === "light" ? "sun" : "moon");
document.getElementById("themeBtn").addEventListener("click", () =>
  updatePrefs({ colorScheme: prefs.colorScheme === "light" ? "dark" : "light" }),
);
document.getElementById("navFullscreen").addEventListener("click", toggleFullscreen);

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => toast("Full screen is unavailable here."));
  } else {
    document.exitFullscreen?.();
  }
}

const MENU_MAIN = [
  ["games", "Games", "gamepad"],
  ["ai", "AI", "bot"],
  ["music", "Music", "music"],
];
const MENU_SECONDARY = [
  ["account", "Account", "user"],
  ["legal", "Legal", "legal"],
  ["settings", "Settings", "settings"],
];

document.getElementById("menuMain").innerHTML = MENU_MAIN.map(
  ([route, label, iconName]) =>
    `<button type="button" data-route="${route}">${icon(iconName)}<span>${label}</span></button>`,
).join("");

document.getElementById("menuSecondary").innerHTML =
  MENU_SECONDARY.map(
    ([route, label, iconName]) =>
      `<button type="button" data-route="${route}">${icon(iconName)}<span>${label}</span></button>`,
  ).join("") + `<button type="button" data-discord>${discordIcon()}<span>Discord</span></button>`;

document.querySelectorAll("#menuMain button, #menuSecondary button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.discord !== undefined) {
      window.open(config.discordUrl, "_blank", "noopener");
      return;
    }
    const route = button.dataset.route;
    const existing = tabs.find((tab) => tab.route === route && !tab.game);
    if (existing) {
      activeId = existing.id;
      renderActive();
    } else {
      navigate(route);
    }
  });
});

document.getElementById("navBack").innerHTML = icon("chevronLeft");
document.getElementById("navForward").innerHTML = icon("chevronRight");
document.getElementById("navReload").innerHTML = icon("reload");
document.getElementById("navFullscreen").innerHTML = icon("maximize");

function travelHistory(step) {
  const next = historyIndex + step;
  if (next < 0 || next >= historyStack.length) return;
  historyIndex = next;
  const entry = historyStack[historyIndex];
  const tab = activeTab();
  if (!tab) return;
  tab.route = entry.route;
  if (entry.route === "web") {
    tab.url = entry.url || tab.url || "";
    tab.title = tab.url ? hostOf(tab.url) : "Web";
  } else {
    tab.title = TITLES[entry.route] || "Tab";
  }
  renderActive();
  syncHistoryButtons();
}

document.getElementById("navBack").addEventListener("click", () => travelHistory(-1));
document.getElementById("navForward").addEventListener("click", () => travelHistory(1));

document.getElementById("navReload").addEventListener("click", () => renderActive());

function syncHistoryButtons() {
  document.getElementById("navBack").disabled = historyIndex <= 0;
  document.getElementById("navForward").disabled = historyIndex >= historyStack.length - 1;
}

/* ------------------------------------------------------------------ */
/* onboarding                                                         */
/* ------------------------------------------------------------------ */

function showOnboarding() {
  let step = 0;
  let draftAccent = prefs.accent;
  let draftTheme = prefs.theme;

  const overlay = document.createElement("div");
  overlay.className = "notice-overlay";
  overlays.appendChild(overlay);

  const steps = [
    {
      icon: "sparkles",
      title: "Welcome to Astral",
      body: `<p class="notice-text">A proxy, games, music player, AI, and much more all in one place. Answer a couple questions to make it yours.</p>`,
    },
    {
      icon: "sun",
      title: "Make it yours",
      body: `<p class="notice-text">Pick an accent colour and a background. You can change both later in Settings.</p>
        <div class="swatch-row">${ACCENTS.map(
          (accent) =>
            `<button class="swatch${accent.name === draftAccent ? " active" : ""}" type="button" data-accent="${accent.name}" style="background:${accent.color}" aria-label="${accent.name}"></button>`,
        ).join("")}</div>
        <div class="theme-row">${Object.entries(THEMES)
          .map(
            ([key, label]) =>
              `<button class="theme-chip${key === draftTheme ? " active" : ""}" type="button" data-theme="${key}">${label}</button>`,
          )
          .join("")}</div>`,
    },
    {
      icon: "globe",
      title: "Choose your search engine",
      body: `<p class="notice-text">Pick what powers the address bar. You can change it anytime.</p>
        <div class="notice-choices">${Object.entries(ENGINES)
          .map(
            ([key, engine]) =>
              `<button class="notice-option${key === prefs.engine ? " selected" : ""}" type="button" data-engine="${key}">${icon(engine.icon)}${engine.name}</button>`,
          )
          .join("")}</div>`,
    },
    {
      icon: "shield",
      title: "A note about ads",
      body: `<p class="notice-text">Astral uses ads to help support the services that keep it running, so it can stay free and fast for everyone.</p>
        <p class="notice-text">If a third-party website opens in a new tab asking you to download software or enable notifications, ignore and close it. That is not from Astral.</p>`,
    },
  ];

  const draw = () => {
    const current = steps[step];
    overlay.innerHTML = `
      <div class="notice-box" role="dialog" aria-modal="true" aria-label="${current.title}">
        <div class="notice-icon">${icon(current.icon)}</div>
        <h2>${current.title}</h2>
        ${current.body}
        <div class="notice-controls">
          <div class="notice-dots">${steps.map((_, index) => `<span class="notice-dot${index === step ? " active" : ""}"></span>`).join("")}</div>
          <div class="notice-buttons">
            <button class="notice-skip" type="button" data-action="skip">Skip</button>
            <button class="notice-next" type="button" data-action="next">${step === steps.length - 1 ? "Get started" : "Next"}</button>
          </div>
        </div>
      </div>`;

    overlay.querySelectorAll("[data-accent]").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        draftAccent = swatch.dataset.accent;
        prefs = { ...prefs, accent: draftAccent };
        applyPrefs(prefs);
        draw();
      });
    });
    overlay.querySelectorAll("[data-theme]").forEach((chip) => {
      chip.addEventListener("click", () => {
        draftTheme = chip.dataset.theme;
        prefs = { ...prefs, theme: draftTheme };
        applyPrefs(prefs);
        draw();
      });
    });
    overlay.querySelectorAll("[data-engine]").forEach((button) => {
      button.addEventListener("click", () => {
        prefs = { ...prefs, engine: button.dataset.engine };
        applyPrefs(prefs);
        draw();
      });
    });

    overlay.querySelector('[data-action="skip"]').addEventListener("click", finish);
    overlay.querySelector('[data-action="next"]').addEventListener("click", () => {
      if (step === steps.length - 1) finish();
      else {
        step += 1;
        draw();
      }
    });
  };

  const finish = () => {
    overlay.remove();
    updatePrefs({ onboardingDone: true });
    maybeShowPlus();
  };

  draw();
}

function maybeShowPlus() {
  if (prefs.plusDismissed) return;
  const popup = document.createElement("div");
  popup.className = "plus-popup";
  popup.innerHTML = `
    <button class="plus-popup-close" type="button" aria-label="Dismiss">${icon("x")}</button>
    <div class="plus-popup-head">Astral Plus <span class="plus-popup-plus">+</span></div>
    <p class="plus-popup-desc">An ad-free experience, faster speeds and links just for you</p>
    <button class="plus-popup-cta" type="button">Learn more</button>`;
  overlays.appendChild(popup);
  popup.querySelector(".plus-popup-close").addEventListener("click", () => {
    popup.remove();
    updatePrefs({ plusDismissed: true });
  });
  popup.querySelector(".plus-popup-cta").addEventListener("click", () => {
    popup.remove();
    navigate("account");
  });
  setTimeout(() => popup.remove(), 16000);
}

/* ------------------------------------------------------------------ */
/* particles                                                          */
/* ------------------------------------------------------------------ */

function startParticles() {
  const canvas = document.getElementById("particles");
  const context = canvas.getContext("2d");
  if (!context) return;

  let width = 0;
  let height = 0;
  let dots = [];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const resize = () => {
    width = canvas.width = window.innerWidth * window.devicePixelRatio;
    height = canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const count = Math.min(90, Math.round((window.innerWidth * window.innerHeight) / 22000));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18 * window.devicePixelRatio,
      vy: (Math.random() - 0.5) * 0.18 * window.devicePixelRatio,
      r: (Math.random() * 1.4 + 0.6) * window.devicePixelRatio,
      a: Math.random() * 0.35 + 0.2,
    }));
  };

  const accent = () => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--accent-rgb").trim();
    return raw || "158 232 197";
  };

  const paint = () => {
    context.clearRect(0, 0, width, height);
    const color = accent().replace(/\s+/g, ",");
    dots.forEach((dot) => {
      dot.x += dot.vx;
      dot.y += dot.vy;
      if (dot.x < 0 || dot.x > width) dot.vx *= -1;
      if (dot.y < 0 || dot.y > height) dot.vy *= -1;
      context.beginPath();
      context.fillStyle = `rgba(${color},${dot.a})`;
      context.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      context.fill();
    });
    const link = 150 * window.devicePixelRatio;
    for (let i = 0; i < dots.length; i += 1) {
      for (let j = i + 1; j < dots.length; j += 1) {
        const dx = dots[i].x - dots[j].x;
        const dy = dots[i].y - dots[j].y;
        const distance = Math.hypot(dx, dy);
        if (distance < link) {
          context.strokeStyle = `rgba(${color},${0.09 * (1 - distance / link)})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(dots[i].x, dots[i].y);
          context.lineTo(dots[j].x, dots[j].y);
          context.stroke();
        }
      }
    }
  };

  const draw = () => {
    paint();
    requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener("resize", resize);
  if (reduced) {
    paint();
    window.addEventListener("resize", paint);
  } else {
    requestAnimationFrame(draw);
  }
}

/* ------------------------------------------------------------------ */
/* keyboard + lifecycle                                               */
/* ------------------------------------------------------------------ */

function keyCombo(event) {
  const parts = [];
  if (event.altKey) parts.push("Alt");
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.metaKey) parts.push("Meta");
  if (event.shiftKey) parts.push("Shift");
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (!["Alt", "Control", "Meta", "Shift"].includes(key)) parts.push(key);
  return parts.join("+");
}

document.addEventListener("keydown", (event) => {
  if (prefs.panicKey && keyCombo(event) === prefs.panicKey) {
    event.preventDefault();
    window.location.href = "https://classroom.google.com/";
    return;
  }
  const meta = event.ctrlKey || event.metaKey;
  if (meta && event.key.toLowerCase() === "t") {
    event.preventDefault();
    newTab("newtab");
  } else if (meta && event.key.toLowerCase() === "w") {
    event.preventDefault();
    closeTab(activeId);
  } else if (meta && event.key.toLowerCase() === "l") {
    event.preventDefault();
    urlInput.focus();
    urlInput.select();
  } else if (event.key === "Escape") {
    suggestionsEl.hidden = true;
    engineMenu.hidden = true;
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!prefs.confirmLeave) return;
  event.preventDefault();
  event.returnValue = "";
});

/* ------------------------------------------------------------------ */
/* boot                                                               */
/* ------------------------------------------------------------------ */

createTab("newtab");
trackHistory("newtab");
renderActive();
syncHistoryButtons();
startParticles();

setTimeout(() => {
  ensureProxy().catch(() => {});
}, 900);

if (!prefs.onboardingDone) {
  showOnboarding();
} else {
  maybeShowPlus();
}

