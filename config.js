/*
 * Astral configuration — the only file you need to edit.
 *
 * This is a plain script, not a module: it loads before the app and simply
 * publishes these values on window.ASTRAL_CONFIG. Edit the values below,
 * save, and reload the site. No build step, no restart.
 */
window.ASTRAL_CONFIG = {
  /*
   * Game library API. Base URL of the backend that lists and serves games.
   * Leave empty while you do not have one; the Games page shows its
   * "There are no games available." message.
   */
  gameApi: "",

  /*
   * Music API. Base URL of the backend that lists and streams songs.
   * Leave empty while you do not have one; the Music page shows its
   * "There are no songs available." message.
   */
  musicApi: "",

  /*
   * Wisp WebSocket server used by the in-app proxy.
   * Example: "wss://wisp.example.com/" (wss:// for HTTPS sites).
   * Leave empty to keep the in-app browser off; links open in normal tabs.
   */
  wisp: "",

  /* Set to false to disable the in-app proxy even when a Wisp URL is set. */
  proxyEnabled: true,

  /*
   * Supabase project for the account backend.
   * Use the Project URL and the public "anon" key from
   * Supabase → Project Settings → API. Leave empty while unused.
   */
  supabase: {
    url: "",
    anonKey: "",
  },
};
