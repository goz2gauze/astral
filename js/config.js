/**
 * Central configuration for the recreation.
 *
 * The editable values live in config.js at the site root; this module just
 * reads them and adds the small constants the UI needs. The original Astral
 * talks to private proxy, game, AI and music backends. Point the values in
 * config.js at your own backends, or leave them empty to keep the
 * "unavailable" messages on those pages.
 */
const external = (typeof window !== "undefined" && window.ASTRAL_CONFIG) || {};
const supabase = external.supabase || {};

export const config = {
  // Version string printed in the bottom-right of the new tab page.
  version: "v1.0.0",

  // Where the Discord menu item points.
  discordUrl: "https://discord.com/",

  // Credit link at the bottom of every page. Replace with your server invite.
  creditUrl: "https://discord.gg/",

  // Backend base URLs, editable in config.js.
  gameApi: String(external.gameApi || "").trim(),
  musicApi: String(external.musicApi || "").trim(),

  // In-app proxy settings.
  wisp: String(external.wisp || "").trim(),
  proxyEnabled: external.proxyEnabled !== false,

  // Account backend.
  supabase: {
    url: String(supabase.url || "").trim(),
    anonKey: String(supabase.anonKey || "").trim(),
  },
};
