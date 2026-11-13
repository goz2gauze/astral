# Astral — front-end recreation

A static, no-build recreation of the [Astral](https://astralon.top/) browser-style start page: the full-width address bar, the left sidebar with vertical tabs and the bottom menu, and the Games, AI, Music, Account, Legal and Settings pages.

Everything is plain HTML, CSS and ES modules — no framework, no bundler, no dependencies.

The original site's games, AI, music, proxy and accounts run on private backends that are not included here. Games, AI and Music are therefore empty by default: each one only says that nothing is available. Edit `config.js` to point the games, music, proxy and Supabase settings at your own backends.

## Run it

Any static file server works, because the site is just files:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>.

Opening `index.html` directly with `file://` will **not** work: browsers block ES module imports from `file://`. Use a local server.

## Deploy to GitHub Pages

1. Create a repository and push this folder to it:

   ```bash
   git init
   git add .
   git commit -m "Astral recreation"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

2. On GitHub: **Settings → Pages → Build and deployment**.
3. Source: **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. The site appears at `https://<you>.github.io/<repo>/` within a minute or two.

All asset paths are relative (`./css/...`, `./js/...`), so it also works from a subdirectory, and from Netlify, Vercel, Cloudflare Pages or any static host.

## What's here

```
config.js             editable settings: game/music APIs, Wisp, Supabase
index.html            shell markup (topbar, sidebar, tabs, menu, overlays)
css/base.css          design tokens, themes, resets, shared controls
css/shell.css         browser chrome: topbar, vertical tabs, sidebar menu, modals
css/pages.css         new tab, empty pages, account, legal, settings
js/main.js            tabs, routing, address bar, onboarding, particles
js/pages.js           one renderer per page
js/store.js           preferences, themes, accounts, history (localStorage)
js/icons.js           inline SVG icon set
js/config.js          reads config.js and exposes the values to the app
js/obfuscate.js       font-obfuscation text scrambler
assets/favicon.svg    favicon
assets/fonts/         glyph-scrambled font, its mapping manifest and OFL license
tools/                build script for the obfuscation font
```

### Credit link

Every page shows a small `recreated by goz!` credit pill at the bottom, linking to the Discord invite set as `creditUrl` in `js/config.js` (change it from the placeholder to your own server invite).

`js/main.js` verifies on boot and on every DOM change that the credit link still exists, still says `recreated by goz!` and still points at a Discord URL. If it is removed or edited, the site replaces itself with an `ERR_CREDIT_MISSING` screen instead of running. That check is client-side only: on a static site, anyone who edits the JavaScript can bypass it.

### Routes

| Address | Page |
| --- | --- |
| `astral://newtab` | New tab (search, shortcuts, clock) |
| `astral://games` | "There are no games available." |
| `astral://ai` | "There are no AI models available." |
| `astral://music` | "There are no songs available." |
| `astral://account` | Sign in / account |
| `astral://legal` | Legal |
| `astral://settings` | Settings |

Type one of those in the address bar (or use the menu) to navigate internally. Anything else — a search query or a URL — opens inside the app through the proxy when one is configured, and in a normal browser tab when it is not.

### In-app web proxy (Wisp)

When a Wisp server is configured, the address bar opens URLs and searches in a proxied tab inside the page area, with the real URL in the address bar and the site title on the tab.

The server is not hard-coded. Everything editable lives in one file, `config.js`, at the site root:

```js
window.ASTRAL_CONFIG = {
  gameApi: "",        // games backend base URL
  musicApi: "",       // music backend base URL
  wisp: "",           // e.g. "wss://wisp.example.com/"
  proxyEnabled: true, // false sends every URL to a normal tab
  supabase: {
    url: "",          // Supabase project URL
    anonKey: "",      // Supabase public anon key
  },
};
```

- `gameApi` / `musicApi` — base URLs for your games and music backends. Empty means the Games and Music pages keep their "There are no … available." message.
- `wisp` — WebSocket URL of your Wisp server. Use `wss://` when the site is served over HTTPS, `ws://` for local development. A trailing slash is added automatically, and `https://` / `http://` values are converted.
- `proxyEnabled` — `false` turns the in-app browser off and sends everything to normal tabs.
- `supabase` — Supabase project URL and public anon key, used for the account backend. Keep the anon key here, never a service-role key; this file is public.

`config.js` is a plain script loaded before the app, so there is no build step — edit it, save, reload. If `wisp` is empty or the proxy is disabled, the address bar falls back to opening a normal tab and explains why once. The proxy only loads its ~2.5 MB of client files after the config passes, so an unconfigured site stays light.

**You need your own Wisp server.** This is a static site, so there is nothing here to terminate the WebSocket. Any Wisp implementation works, for example [`@mercuryworkshop/wisp-js`](https://www.npmjs.com/package/@mercuryworkshop/wisp-js) behind a TLS proxy (or `wisp-server-node`):

```js
import { createServer } from "node:http";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const server = createServer(/* your normal static handler */);
server.on("upgrade", (req, socket, head) => {
  if (new URL(req.url, "http://localhost").pathname !== "/wisp/") return socket.end();
  wisp.routeRequest(req, socket, head);
});
server.listen(3005);
```

Then point `wisp` in `config.js` at it (`wss://your-host/wisp/`). The browser connects to that URL directly, so it must be publicly reachable, not `localhost`, once the site is deployed.

How it is wired: `js/proxy.js` registers `proxy/sw.js` with scope `proxy/`, loads Ultraviolet from `proxy/uv/`, and configures the libcurl transport in `proxy/libcurl/` with the Wisp URL. Proxied pages are served from `proxy/service/<encoded-url>`, so the site also works from a subdirectory such as GitHub Pages.

Proxying needs a service worker, which browsers only allow over HTTPS (or `localhost`). Sites that actively detect proxies, or that need a login the proxy cannot replay, may still fail.

### Settings

*Four tabs, all persisted in `localStorage`.*

- **Appearance** — light/dark, font, five themes, five accent colors.
- **New Tab** — search engine, shortcut visibility, background color/image.
- **Privacy** — tab disguise (changes the title and favicon), confirm-before-leave, `about:blank` handoff, panic key.
- **Data** — export/import a settings code, clear local storage.

### Font obfuscation

Font obfuscation is always on and has no setting. Every visible text node is scrambled with a fixed cipher (letters rotate 13 places, digits 5) and the page uses `assets/fonts/astral-obfuscated.woff2`, a glyph-remapped build of Inter. The font maps each scrambled character back to the real glyph, so the page still reads normally while the HTML/DOM only contains the cipher. `js/store.js` applies it on every boot and preference change; removing the `setFontObfuscation(true)` call there is the only way to disable it.

The font is preloaded in `index.html`, and text is scrambled only after `js/obfuscate.js` has confirmed that the font loaded and is the expected build: it reads `assets/fonts/astral-obfuscated.json`, checks the font's character mapping against the cipher, verifies the font's SHA-256 against the manifest, and waits for `document.fonts.load()`. If any of that fails, the page is left unscrambled in the normal UI font rather than showing unreadable cipher text. `tools/build-obfuscation-font.py` verifies every glyph mapping against the source font and regenerates the manifest whenever the font is rebuilt, so the font and cipher cannot silently drift apart.

This raises the effort needed for keyword-based content scanners, but it is not encryption: the font and cipher are public and fixed. It also breaks copy-paste and screen readers, and it only covers text in this document — form fields, attributes, the document title and proxied pages are not obfuscated. The credit link and form controls stay in the normal UI font.

The font is built from [Inter](https://github.com/google/fonts/tree/main/ofl/inter) (SIL Open Font License, license in `assets/fonts/OFL.txt`). To rebuild it after changing the cipher:

```bash
python3 -m pip install fonttools brotli
curl -L -o /tmp/Inter.ttf "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf"
python3 tools/build-obfuscation-font.py /tmp/Inter.ttf
```

Keep the rotation in `tools/build-obfuscation-font.py` and `js/obfuscate.js` identical, or text will render incorrectly.

## Scope

- **Games, AI and Music are empty on purpose.** The game catalog, game files, model endpoint and streaming library all lived behind the original site's APIs. Re-adding a page means designing its data layer; nothing here pretends to have one.
- **Accounts are a local demo.** Sign-in writes a session to `localStorage`; no credentials are sent anywhere. No account server is included.
- **The proxy needs a Wisp server.** The front-end and transport are included and configured by you; no proxy server, and therefore no unblocking, is hosted by this repository.

## Credits

This is an independent, non-commercial front-end recreation made for learning, based on the public interface of [astralon.top](https://astralon.top/). It is not affiliated with or endorsed by Astral. Layout, copy and design language follow the original site; the implementation is new.

The in-app browser vendors [Ultraviolet](https://github.com/titaniumnetwork-dev/Ultraviolet) (`proxy/uv`), [bare-mux](https://github.com/MercuryWorkshop/bare-mux) (`proxy/baremux`) and the [libcurl transport](https://github.com/MercuryWorkshop/libcurl-transport) (`proxy/libcurl`). Each directory keeps its upstream license file, and the transport and service-worker code are AGPL-3.0; review those licenses before publishing.

Fonts load from Google Fonts (Poppins, Inter, JetBrains Mono), as on the original site. The obfuscation font is a modified build of Inter, used under the SIL Open Font License (`assets/fonts/OFL.txt`). Use your own branding, copy and content if you publish this publicly.
