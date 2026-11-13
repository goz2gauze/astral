/*
 * Font obfuscation.
 *
 * When enabled, every visible text node is scrambled with a fixed cipher
 * (letters rotate by 13, digits by 5) and the page switches to
 * assets/fonts/astral-obfuscated.woff2. That font maps each scrambled
 * codepoint back to the glyph of the real character, so people still read
 * normal text while the DOM (and anything that scrapes it) only sees the
 * cipher.
 *
 * The font and this cipher must stay in sync: tools/build-obfuscation-font.py
 * builds the font from the same rotation.
 */

const SKIP = [
  "script",
  "style",
  "noscript",
  "textarea",
  "input",
  "select",
  "option",
  "#academySplash",
  "[data-credit]",
  ".site-credit",
].join(",");

const FONT_FAMILY = "Astral Obfuscated";
const MANIFEST_URL = new URL("../assets/fonts/astral-obfuscated.json", import.meta.url);
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

let active = false;
let failed = false;
let fontPromise = null;
let observer = null;
let originals = new WeakMap();

export function scrambleText(text) {
  let out = "";
  for (const ch of text) {
    if (ch >= "A" && ch <= "Z") out += String.fromCharCode(65 + ((ch.charCodeAt(0) - 65 + 13) % 26));
    else if (ch >= "a" && ch <= "z") out += String.fromCharCode(97 + ((ch.charCodeAt(0) - 97 + 13) % 26));
    else if (ch >= "0" && ch <= "9") out += String((Number(ch) + 5) % 10);
    else out += ch;
  }
  return out;
}

function scrambleNode(node) {
  const parent = node.parentElement;
  if (!parent || parent.closest(SKIP)) return;

  const text = node.data;
  const previous = originals.get(node);
  // Already scrambled: our own characterData mutation coming back around.
  if (previous !== undefined && text === scrambleText(previous)) return;

  const scrambled = scrambleText(text);
  originals.set(node, text);
  if (scrambled !== text) node.data = scrambled;
}

function scan(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    scrambleNode(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) scrambleNode(node);
}

function onMutations(records) {
  for (const record of records) {
    if (record.type === "characterData") scrambleNode(record.target);
    else for (const node of record.addedNodes) scan(node);
  }
}

function restoreText() {
  if (!document.body) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = originals.get(node);
    if (text !== undefined && node.data === scrambleText(text)) node.data = text;
  }
  originals = new WeakMap();
}

function stopObfuscation() {
  document.documentElement.classList.remove("font-obfuscated");
  if (observer) observer.disconnect();
  observer = null;
  if (active) restoreText();
  active = false;
}

/*
 * Never scramble text until the font has been loaded and proven to match this
 * file's cipher. The manifest lists the mapping the font was built with;
 * tools/build-obfuscation-font.py writes it after checking every glyph in the
 * generated font against the source outlines. Any failure leaves the ordinary
 * font in place so the page stays readable instead of showing cipher text.
 */
async function confirmFont() {
  const response = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`font manifest returned ${response.status}`);
  const manifest = await response.json();
  if (!manifest || manifest.family !== FONT_FAMILY || !manifest.mapping) {
    throw new Error("font manifest is missing its mapping");
  }
  for (const ch of ALPHABET) {
    if (manifest.mapping[ch] !== scrambleText(ch)) {
      throw new Error(`font mapping for ${JSON.stringify(ch)} does not match the cipher`);
    }
  }

  const faces = await document.fonts.load(`16px "${FONT_FAMILY}"`, "Aa0");
  if (!faces.length || !document.fonts.check(`16px "${FONT_FAMILY}"`, "Aa0")) {
    throw new Error("the obfuscation font did not load");
  }
}

function enableObfuscation() {
  if (active || observer || fontPromise || failed) return;

  fontPromise = confirmFont()
    .then(() => {
      if (!document.body) throw new Error("document body is not ready");
      document.documentElement.classList.add("font-obfuscated");
      scan(document.body);
      observer = new MutationObserver(onMutations);
      observer.observe(document.body, { subtree: true, childList: true, characterData: true });
      active = true;
    })
    .catch((error) => {
      failed = true;
      stopObfuscation();
      console.warn(`[Astral] Font obfuscation is off, page text stays readable: ${error.message}`);
    })
    .finally(() => {
      fontPromise = null;
    });
}

export function setFontObfuscation(enabled) {
  if (!enabled) {
    stopObfuscation();
    return;
  }
  enableObfuscation();
}
