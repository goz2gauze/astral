import { icon } from "./icons.js";
import { config } from "./config.js";
import { ACCENTS, DISGUISES, ENGINES, THEMES, THEME_SWATCHES, shortcutIcon } from "./store.js";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);

/* ------------------------------------------------------------------ */
/* New tab                                                             */
/* ------------------------------------------------------------------ */

export function renderNewTab(root, ctx) {
  const { prefs } = ctx;
  const engine = ENGINES[prefs.engine] || ENGINES.duckduckgo;
  const backgroundStyle = [
    prefs.background ? `background-color:${esc(prefs.background)}` : "",
    prefs.backgroundImage ? `background-image:url("${esc(prefs.backgroundImage)}")` : "",
  ]
    .filter(Boolean)
    .join(";");

  const tiles = (prefs.showShortcuts ? prefs.shortcuts : [])
    .map((shortcut, index) => {
      const custom = !shortcut.route;
      return `
        <div class="shortcut" data-shortcut="${index}" title="${esc(shortcut.name)}">
          <button class="shortcut-open" type="button" data-shortcut-open="${index}">
            ${shortcutIcon(shortcut)}
            <span class="shortcut-name">${esc(shortcut.name)}</span>
          </button>
          ${
            custom
              ? `<button class="shortcut-menu-trigger" data-shortcut-menu="${index}" aria-label="Shortcut options" type="button"></button>
                 <div class="shortcut-menu" data-shortcut-panel="${index}">
                   <button type="button" data-remove-shortcut="${index}">Remove</button>
                 </div>`
              : ""
          }
        </div>`;
    })
    .join("");

  root.innerHTML = `
    <div class="newtab-root" style="${backgroundStyle}">
      <div class="wrap">
        <div class="brand">astral</div>
        <form class="search-form" id="newtabSearch" autocomplete="off">
          <div class="search-container">
            <span class="search-icon">${icon("search")}</span>
            <input class="search-input" id="newtabInput" type="text" placeholder="Search ${esc(engine.name)}" spellcheck="false" aria-label="Search the web" />
            <button class="search-submit" id="newtabSubmit" type="submit" aria-label="Search" disabled>${icon("forward")}</button>
          </div>
        </form>
        ${
          prefs.showShortcuts
            ? `<div class="shortcuts"><div class="shortcut-list">${tiles}
                 <button class="shortcut-add" id="addShortcut" type="button">${icon("plus")}<span class="shortcut-name">Add shortcut</span></button>
               </div></div>`
            : `<div class="shortcuts"></div>`
        }
      </div>
      <div class="clock"><div class="clock-time"></div><div class="date"></div></div>
      <div class="newtab-build">${esc(config.version)}</div>
      <div class="shortcut-form" id="shortcutForm">
        <h3>Add a shortcut</h3>
        <input id="shortcutName" type="text" placeholder="Name" maxlength="24" />
        <input id="shortcutUrl" type="text" placeholder="https://example.com or astral://games" />
        <div class="shortcut-form-actions">
          <button type="button" id="shortcutCancel">Cancel</button>
          <button type="button" class="primary" id="shortcutSave">Add</button>
        </div>
      </div>
    </div>`;

  const clockTime = root.querySelector(".clock-time");
  const clockDate = root.querySelector(".date");
  const updateClock = () => {
    const now = new Date();
    clockTime.textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    clockDate.textContent = now.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };
  updateClock();
  const timer = setInterval(updateClock, 1000);
  ctx.onCleanup(() => clearInterval(timer));

  const form = root.querySelector("#newtabSearch");
  const input = root.querySelector("#newtabInput");
  const submit = root.querySelector("#newtabSubmit");

  input.addEventListener("input", () => {
    submit.disabled = input.value.trim().length === 0;
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    ctx.search(value);
    input.value = "";
    submit.disabled = true;
  });

  root.querySelectorAll("[data-shortcut-open]").forEach((button) => {
    button.addEventListener("click", () => {
      const shortcut = ctx.prefs.shortcuts[Number(button.dataset.shortcutOpen)];
      if (!shortcut) return;
      if (shortcut.route) ctx.navigate(shortcut.route);
      else if (shortcut.url) window.open(shortcut.url, "_blank", "noopener");
    });
  });

  root.querySelectorAll("[data-shortcut-menu]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const index = button.dataset.shortcutMenu;
      const panel = root.querySelector(`[data-shortcut-panel="${index}"]`);
      const open = panel.classList.contains("is-open");
      root.querySelectorAll(".shortcut-menu").forEach((menu) => menu.classList.remove("is-open"));
      panel.classList.toggle("is-open", !open);
    });
  });

  root.querySelectorAll("[data-remove-shortcut]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const index = Number(button.dataset.removeShortcut);
      const shortcuts = ctx.prefs.shortcuts.filter((_, i) => i !== index);
      ctx.updatePrefs({ shortcuts });
    });
  });

  const addButton = root.querySelector("#addShortcut");
  const dialog = root.querySelector("#shortcutForm");
  const nameInput = root.querySelector("#shortcutName");
  const urlInput = root.querySelector("#shortcutUrl");

  const closeDialog = () => dialog.classList.remove("is-open");
  addButton?.addEventListener("click", () => {
    dialog.classList.add("is-open");
    nameInput.value = "";
    urlInput.value = "";
    setTimeout(() => nameInput.focus(), 30);
  });
  root.querySelector("#shortcutCancel")?.addEventListener("click", closeDialog);
  root.querySelector("#shortcutSave")?.addEventListener("click", () => {
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    if (!name || !url) {
      ctx.toast("A name and a URL are both required.");
      return;
    }
    let route = "";
    if (url.startsWith("astral://")) {
      route = url.replace("astral://", "").replace(/\/$/, "") || "newtab";
      url = "";
    } else if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    ctx.updatePrefs({
      shortcuts: [...ctx.prefs.shortcuts, { name, url, route, icon: route ? "sparkles" : "globe" }],
    });
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
}

/* ------------------------------------------------------------------ */
/* Feature pages whose APIs are not part of this recreation            */
/* ------------------------------------------------------------------ */

function apiEmpty(title, message) {
  return `
    <div class="api-empty">
      <h1>${esc(title)}</h1>
      <p>${esc(message)}</p>
    </div>`;
}

export function renderGames(root) {
  root.innerHTML = apiEmpty("Games", "There are no games available.");
}

export function renderAI(root) {
  root.innerHTML = apiEmpty("AI", "There are no AI models available.");
}

export function renderMusic(root) {
  root.innerHTML = apiEmpty("Music", "There are no songs available.");
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

let accountMode = "signin";

export function renderAccount(root, ctx) {
  const user = ctx.user;

  if (user) {
    root.innerHTML = `
      <div class="account-page" style="width:100%;height:100%">
        <div class="account-content">
          <h1>Account</h1>
          <div class="account-row account-card">
            <div class="setting-info">
              <span class="setting-name">Signed in</span>
              <span class="account-mono">${esc(user.email)}</span>
            </div>
            <span class="plan-badge ${user.plan === "plus" ? "plus" : "free"}">${user.plan === "plus" ? "PLUS" : "FREE"}</span>
          </div>
          <div class="account-plus-bar">
            <span class="setting-name">Astral Plus</span>
            <span class="setting-desc">An ad-free experience, faster speeds and links just for you.</span>
            <button class="account-plus-btn" type="button" id="accountPlus">Learn more</button>
          </div>
          <div class="account-row">
            <div class="setting-info">
              <span class="setting-name">Session</span>
              <span class="setting-desc">Stored in this browser only — this recreation has no account server.</span>
            </div>
            <button class="account-signout" type="button" id="accountSignOut">${icon("logout")} Sign out</button>
          </div>
          <p class="settings-note">Accounts in this build are local demo sessions. Sign in with any email to explore the signed-in views.</p>
        </div>
      </div>`;

    root.querySelector("#accountSignOut").addEventListener("click", () => {
      ctx.setUser(null);
      ctx.toast("Signed out.");
    });
    root.querySelector("#accountPlus").addEventListener("click", () => ctx.toast("Astral Plus checkout is not part of this recreation."));
    return;
  }

  const isSignup = accountMode === "signup";
  root.innerHTML = `
    <div class="account-page" style="width:100%;height:100%">
      <div class="account-content">
        <h1>Account</h1>
        <div class="account-auth">
          <h2>${isSignup ? "Create an account" : "Sign in"}</h2>
          <p class="account-auth-sub">${isSignup ? "Access your Astral account" : "Access your Astral account"}</p>
          <form class="account-form" id="accountForm" novalidate>
            <label>Email
              <input type="email" id="accountEmail" placeholder="you@example.com" autocomplete="email" />
            </label>
            <label>Password
              <input type="password" id="accountPassword" placeholder="••••••••" autocomplete="current-password" />
            </label>
            <p class="account-error" id="accountError" hidden></p>
            <button class="account-submit" type="submit">${isSignup ? "Create account" : "Sign in"}</button>
          </form>
          <button class="account-switch" type="button" id="accountSwitch">
            ${isSignup ? "Already have an account? Sign in" : "No account? Sign up"}
          </button>
        </div>
        <p class="settings-note">Local demo — no credentials leave this browser.</p>
      </div>
    </div>`;

  root.querySelector("#accountSwitch").addEventListener("click", () => {
    accountMode = isSignup ? "signin" : "signup";
    ctx.rerender();
  });

  root.querySelector("#accountForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const email = root.querySelector("#accountEmail").value.trim();
    const password = root.querySelector("#accountPassword").value;
    const error = root.querySelector("#accountError");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error.textContent = "Enter a valid email address.";
      error.hidden = false;
      return;
    }
    if (password.length < 4) {
      error.textContent = "Use at least 4 characters for the demo password.";
      error.hidden = false;
      return;
    }
    error.hidden = true;
    ctx.setUser({ email, plan: "free" });
    ctx.toast(isSignup ? "Account created locally." : "Signed in.");
  });
}

/* ------------------------------------------------------------------ */
/* Legal                                                               */
/* ------------------------------------------------------------------ */

export function renderLegal(root) {
  root.innerHTML = `
    <div class="legal-root">
      <main>
        <section>
          <h2>What is Astral?</h2>
          <p>Astral fetches and rewrites websites through our servers, which can improve your privacy when browsing online.</p>
          <p>Extras like Astral AI and other browser features ride along with that.</p>
        </section>
        <section>
          <h2>Terms of Service</h2>
          <h3>Acceptable Use</h3>
          <p>You agree to use Astral responsibly and only for lawful purposes.</p>
          <p>You must not use Astral to:</p>
          <ul>
            <li>Access or distribute illegal content.</li>
            <li>Distribute inappropriate, abusive, or harmful content.</li>
            <li>Attempt to harm, disrupt, or abuse Astral or its infrastructure.</li>
            <li>Attempt to bypass security controls or access restrictions.</li>
            <li>Use Astral for fraudulent or malicious activities.</li>
          </ul>
          <h3>Third-Party Websites</h3>
          <p>Astral is not responsible for the content, availability, or policies of third-party websites accessed from it.</p>
          <h3>Availability</h3>
          <p>The service is provided "as available". Features may change, break, or be retired at any time, without notice.</p>
        </section>
        <section>
          <h2>Privacy Policy</h2>
          <p>We keep our data collection practices simple and minimal:</p>
          <ul>
            <li>We may log URLs visited through Astral to deliver and route requests.</li>
            <li>We may log interactions and prompts sent through Astral AI.</li>
            <li>Third party services used like Google Analytics have access to user behavior on the site.</li>
          </ul>
          <p>These logs are used exclusively to operate, maintain, troubleshoot, and improve the reliability of Astral. This policy will be updated if our collection practices change.</p>
          <p class="contact">Questions about any of this? <a href="mailto:hello@example.com">hello@example.com</a></p>
        </section>
        <section>
          <h2>About this copy</h2>
          <p>This site is an independent front-end recreation of Astral, built as a static website. It is not affiliated with or endorsed by Astral, and it does not run the original proxy, AI or music services. Game names are listed for interface purposes only; no game files are hosted here.</p>
        </section>
        <footer>© 2026 ASTRAL — RECREATION</footer>
      </main>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

let settingsTab = "Appearance";
let recordingPanic = false;

function row(name, desc, control) {
  return `
    <div class="setting-row">
      <div class="setting-info">
        <span class="setting-name">${esc(name)}</span>
        <span class="setting-desc">${esc(desc)}</span>
      </div>
      ${control}
    </div>`;
}

function select(id, value, options) {
  return `<select class="settings-select" id="${id}">
    ${Object.entries(options)
      .map(([key, label]) => `<option value="${esc(key)}"${key === value ? " selected" : ""}>${esc(label)}</option>`)
      .join("")}
  </select>`;
}

function toggle(id, on, label) {
  return `<button class="settings-toggle${on ? " on" : ""}" id="${id}" type="button" role="switch" aria-checked="${on}" aria-label="${esc(label)}"><span class="settings-toggle-knob"></span></button>`;
}

function exportCode(prefs) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(prefs))));
  } catch {
    return "";
  }
}

function importCode(code) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  } catch {
    return null;
  }
}

export function renderSettings(root, ctx) {
  const { prefs } = ctx;
  let codeMode = "Export";
  let importedValue = "";

  const tabs = ["Appearance", "New Tab", "Privacy", "Data"];

  const body = () => {
    if (settingsTab === "New Tab") {
      return `
        ${row("Search Engine", "Used for the address bar and new tab", select("setEngine", prefs.engine, Object.fromEntries(Object.entries(ENGINES).map(([key, value]) => [key, value.name]))))}
        ${row("Show Shortcuts", "Shortcut tiles under the search box", toggle("setShortcuts", prefs.showShortcuts, "Show shortcuts"))}
        ${row(
          "Background Color",
          "Solid color behind the new tab page",
          `<div class="settings-form">
             <input class="settings-color" type="color" id="setBackground" value="${esc(prefs.background || "#0b130e")}" />
             <button class="settings-run" type="button" id="clearBackground">Reset</button>
           </div>`,
        )}
        ${row(
          "Background Image",
          "Image URL; empty uses the plain background",
          `<div class="settings-form">
             <input class="settings-input" type="url" id="setImage" placeholder="https://…" value="${esc(prefs.backgroundImage)}" />
             <button class="settings-run" type="button" id="saveImage">Save</button>
           </div>`,
        )}`;
    }

    if (settingsTab === "Privacy") {
      return `
        ${row("Tab Disguise", "Disguise the tab as a school site", select("setDisguise", prefs.disguise, DISGUISES))}
        ${row("Confirm Before Leave", "Ask for confirmation before closing the window", toggle("setConfirm", prefs.confirmLeave, "Confirm before leaving"))}
        ${row(
          "Open in about:blank",
          "Reopen Astral in an about:blank window and mask this tab",
          `<button class="settings-run" type="button" id="openBlank">Open</button>`,
        )}
        ${row(
          "Panic Key",
          "Press the key to instantly leave; letters and numbers require Alt + key",
          `<div class="settings-form">
             <button class="settings-run" type="button" id="panicRecord">${recordingPanic ? "Press a key…" : esc(prefs.panicKey || "Record")}</button>
             <button class="settings-run" type="button" id="panicSave"${recordingPanic ? " disabled" : ""}>Save</button>
           </div>`,
        )}`;
    }

    if (settingsTab === "Data") {
      const value = codeMode === "Export" ? exportCode(prefs) : importedValue;
      return `
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">Settings Code</span>
            <span class="setting-desc">Copy this code onto another Astral link and load it there</span>
          </div>
          <div class="settings-code-box">
            <div class="settings-code-tabs">
              ${["Export", "Import"].map((mode) => `<button type="button" data-code-mode="${mode}" class="${mode === codeMode ? "active" : ""}">${mode}</button>`).join("")}
            </div>
            ${
              codeMode === "Export"
                ? `<div class="settings-code-value" title="${esc(value)}">${esc(value.slice(0, 22))}…</div>`
                : `<input class="settings-input" style="width:100%" id="codeInput" placeholder="Paste a settings code" value="${esc(importedValue)}" />`
            }
            <div class="settings-code-actions">
              <button class="settings-run" type="button" id="codeAction">${codeMode === "Export" ? "Copy" : "Load"}</button>
            </div>
          </div>
        </div>
        <p class="settings-warning">Warning: only use the following option if you know what you are doing.</p>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-name">Clear local storage</span>
            <span class="setting-desc">Removes shortcuts, preferences, and saved data</span>
          </div>
          <button class="settings-run" type="button" id="clearStorage">Run</button>
        </div>`;
    }

    return `
      ${row("Color Scheme", "Light or dark across Astral", select("setScheme", prefs.colorScheme, { dark: "Dark", light: "Light" }))}
      ${row("Font", "Typeface used across the whole site", select("setFont", prefs.font, { Poppins: "Poppins", Inter: "Inter", System: "System" }))}
      ${row(
        "Theme",
        "Full look; Default lets you pick your own accent",
        `<div class="accent-swatches">${Object.entries(THEMES).map(
          ([key, label]) =>
            `<button class="swatch swatch-bg${key === prefs.theme ? " active" : ""}" type="button" data-theme-choice="${key}" style="background:${THEME_SWATCHES[key]}" title="${label}" aria-label="${label}"></button>`,
        ).join("")}</div>`,
      )}
      ${row(
        "Accent Color",
        "Used for highlights, buttons, and glows",
        `<div class="accent-swatches">${ACCENTS.map(
          (accent) =>
            `<button class="swatch${accent.name === prefs.accent ? " active" : ""}" type="button" data-accent="${accent.name}" style="background:${accent.color}" title="${accent.name}" aria-label="${accent.name}"${prefs.theme !== "default" ? " disabled" : ""}></button>`,
        ).join("")}</div>`,
      )}`;
  };

  root.innerHTML = `
    <div class="settings-page" style="width:100%;height:100%">
      <div class="settings-content">
        <h1>Settings</h1>
        <div class="settings-nav">
          ${tabs.map((tab) => `<button type="button" data-settings-tab="${tab}" class="${tab === settingsTab ? "active" : ""}">${tab}</button>`).join("")}
        </div>
        <div class="settings-list">${body()}</div>
      </div>
    </div>`;

  const $ = (selector) => root.querySelector(selector);
  const update = (patch) => ctx.updatePrefs(patch);

  root.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      settingsTab = button.dataset.settingsTab;
      ctx.rerender();
    });
  });

  if (settingsTab === "Appearance") {
    $("#setScheme").addEventListener("change", (event) => update({ colorScheme: event.target.value }));
    $("#setFont").addEventListener("change", (event) => update({ font: event.target.value }));
    root.querySelectorAll("[data-theme-choice]").forEach((swatch) => {
      swatch.addEventListener("click", () => update({ theme: swatch.dataset.themeChoice }));
    });
    root.querySelectorAll("[data-accent]").forEach((swatch) => {
      swatch.addEventListener("click", () => {
        if (prefs.theme !== "default") return;
        update({ accent: swatch.dataset.accent });
      });
    });
  }

  if (settingsTab === "New Tab") {
    $("#setEngine").addEventListener("change", (event) => update({ engine: event.target.value }));
    $("#setShortcuts").addEventListener("click", () => update({ showShortcuts: !prefs.showShortcuts }));
    $("#setBackground").addEventListener("change", (event) => update({ background: event.target.value }));
    $("#clearBackground").addEventListener("click", () => update({ background: "", backgroundImage: "" }));
    $("#saveImage").addEventListener("click", () => {
      const value = $("#setImage").value.trim();
      update({ backgroundImage: value });
      ctx.toast(value ? "Background image saved." : "Background image cleared.");
    });
  }

  if (settingsTab === "Privacy") {
    $("#setDisguise").addEventListener("change", (event) => update({ disguise: event.target.value }));
    $("#setConfirm").addEventListener("click", () => update({ confirmLeave: !prefs.confirmLeave }));
    $("#openBlank").addEventListener("click", () => ctx.openAboutBlank());
    $("#panicRecord").addEventListener("click", () => {
      recordingPanic = true;
      ctx.rerender();
      const handler = (event) => {
        event.preventDefault();
        const parts = [];
        if (event.altKey) parts.push("Alt");
        if (event.ctrlKey) parts.push("Ctrl");
        if (event.metaKey) parts.push("Meta");
        if (event.shiftKey) parts.push("Shift");
        const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
        if (!["Alt", "Control", "Meta", "Shift"].includes(key)) parts.push(key);
        update({ panicKey: parts.join("+") });
        recordingPanic = false;
        document.removeEventListener("keydown", handler, true);
        ctx.rerender();
      };
      document.addEventListener("keydown", handler, true);
      ctx.onCleanup(() => document.removeEventListener("keydown", handler, true));
    });
  }

  if (settingsTab === "Data") {
    root.querySelectorAll("[data-code-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        codeMode = button.dataset.codeMode;
        ctx.rerender();
      });
    });
    const codeInput = $("#codeInput");
    codeInput?.addEventListener("input", () => {
      importedValue = codeInput.value;
    });
    $("#codeAction").addEventListener("click", async () => {
      if (codeMode === "Export") {
        try {
          await navigator.clipboard.writeText(exportCode(prefs));
          ctx.toast("Settings code copied.");
        } catch {
          ctx.toast("Copy blocked by the browser.");
        }
        return;
      }
      const parsed = importCode(importedValue);
      if (!parsed || typeof parsed !== "object") {
        ctx.toast("That settings code could not be read.");
        return;
      }
      ctx.updatePrefs(parsed);
      ctx.toast("Settings imported.");
    });
    $("#clearStorage").addEventListener("click", () => ctx.resetAll());
  }
}
