import { icon } from "./icons.js";
import { setFontObfuscation } from "./obfuscate.js";

const PREFS_KEY = "astral.prefs.v1";
const USER_KEY = "astral.account.v1";
const HISTORY_KEY = "astral.history.v1";

export const ENGINES = {
  duckduckgo: { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=", icon: "search" },
  brave: { name: "Brave", url: "https://search.brave.com/search?q=", icon: "shield" },
  bing: { name: "Bing", url: "https://www.bing.com/search?q=", icon: "globe" },
};

export const ACCENTS = [
  { name: "Mint", color: "#9fe8c0", rgb: "159 232 192", contrast: "#10231b" },
  { name: "Pumpkin", color: "#f2a168", rgb: "242 161 104", contrast: "#2f1710" },
  { name: "Lavender", color: "#dda8e9", rgb: "221 168 233", contrast: "#2a1530" },
  { name: "Amber", color: "#f0c98a", rgb: "240 201 138", contrast: "#2b2109" },
  { name: "Rose", color: "#f0a2b4", rgb: "240 162 180", contrast: "#2f111a" },
];

export const THEMES = {
  default: "Default",
  orange: "Orange",
  midnight: "Midnight",
  grape: "Grape",
  slate: "Slate",
};

/* Circle colours shown in Settings → Theme, straight from astralon.top. */
export const THEME_SWATCHES = {
  default: "#0b130e",
  orange: "#f2a168",
  midnight: "#0b0f19",
  grape: "#120e1b",
  slate: "#0e1013",
};

/* Every non-Default theme is a full look with its own fixed accent. */
export const THEME_ACCENTS = {
  orange: { name: "Pumpkin", color: "#f2a168", rgb: "242 161 104", contrast: "#2f1710" },
  midnight: { name: "Blue", color: "#86a5ff", rgb: "134 165 255", contrast: "#0d1a33" },
  grape: { name: "Violet", color: "#c2a8f9", rgb: "194 168 249", contrast: "#1e1233" },
  slate: { name: "Slate", color: "#a9b6c9", rgb: "169 182 201", contrast: "#1a2028" },
};

export const FONTS = {
  Poppins: '"Poppins", "Inter", sans-serif',
  Inter: '"Inter", "Poppins", sans-serif',
  System: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
};

export const DISGUISES = {
  none: "None",
  classroom: "Google Classroom",
  docs: "Google Docs",
  khan: "Khan Academy",
  wikipedia: "Wikipedia",
};

export const DEFAULT_SHORTCUTS = [
  { name: "Games", route: "games", icon: "gamepad" },
  { name: "AI", route: "ai", icon: "bot" },
  { name: "Music", route: "music", icon: "music" },
];

export const DEFAULT_PREFS = {
  colorScheme: "dark",
  font: "Poppins",
  theme: "default",
  accent: "Mint",
  engine: "duckduckgo",
  showShortcuts: true,
  background: "",
  backgroundImage: "",
  shortcuts: DEFAULT_SHORTCUTS,
  disguise: "none",
  confirmLeave: false,
  panicKey: "",
  onboardingDone: false,
  plusDismissed: false,
  sidebarOpen: true,
};

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    const prefs = { ...DEFAULT_PREFS, ...parsed };
    if (prefs.theme === "forest" || !THEMES[prefs.theme]) prefs.theme = "default";
    return prefs;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage can be unavailable in private modes */
  }
}

export function clearLocalData() {
  try {
    localStorage.removeItem(PREFS_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(full, 16);
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
}

export function accentByName(name) {
  return ACCENTS.find((a) => a.name === name) || ACCENTS[0];
}

export function applyPrefs(prefs) {
  const root = document.documentElement;
  const accent = THEME_ACCENTS[prefs.theme] || accentByName(prefs.accent);
  root.dataset.theme = prefs.theme;
  root.classList.toggle("light", prefs.colorScheme === "light");
  root.style.setProperty("--accent-color", accent.color);
  root.style.setProperty("--accent-rgb", accent.rgb);
  root.style.setProperty("--accent-1", accent.color);
  root.style.setProperty("--accent-contrast", accent.contrast);
  root.style.setProperty("--font-ui", FONTS[prefs.font] || FONTS.Poppins);
  // Font obfuscation is a permanent feature: always on, no setting.
  setFontObfuscation(true);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", prefs.colorScheme === "light" ? "#f8f3ec" : getComputedStyle(root).getPropertyValue("--bg").trim() || "#0b130e");

  applyDisguise(prefs.disguise);
}

const DISGUISE_META = {
  none: { title: "Astral", color: "#9ee8c5" },
  classroom: { title: "Stream - Google Classroom", color: "#1a73e8" },
  docs: { title: "Untitled document - Google Docs", color: "#4285f4" },
  khan: { title: "Khan Academy | Free Online Courses", color: "#14bf96" },
  wikipedia: { title: "Wikipedia, the free encyclopedia", color: "#636466" },
};

export function applyDisguise(disguise) {
  const meta = DISGUISE_META[disguise] || DISGUISE_META.none;
  document.title = meta.title;
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${meta.color}"/><text x="32" y="44" font-family="Arial" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">${meta.title.charAt(0)}</text></svg>`;
  link.setAttribute("href", `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

export function loadUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function pushHistory(entry) {
  if (!entry) return;
  const next = [entry, ...loadHistory().filter((item) => item !== entry)].slice(0, 12);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function shortcutIcon(shortcut) {
  if (shortcut.icon) return icon(shortcut.icon);
  return icon("globe");
}
