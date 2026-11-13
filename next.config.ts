import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Hosts allowed to reach dev-server internals from another origin.
   *
   * Testing on a phone means loading the site over the LAN address rather than
   * localhost, which makes the hot-reload socket a cross-origin request — blocked by
   * default, so the page loads but never updates and every change needs a manual
   * refresh. Private-range addresses only, and it has no effect on a production build.
   */
  allowedDevOrigins: ["192.168.1.193","192.168.1.105", "*.local"],

  images: {
    /**
     * Next 16 requires the quality allowlist to be explicit, and the default is `[75]`
     * alone. 75 is right for the gallery thumbnails; it is not right for the enlarged
     * view, where the subject is interface text and 75 turns small glyphs to mush —
     * which defeats the only reason the enlarged view exists.
     *
     * Two values, not a range: every entry is another variant the optimiser can be
     * asked to generate, so this is an allowlist rather than a preference.
     */
    qualities: [75, 92],
  },

  async rewrites() {
    // /room and /room/ both serve the room's entry document.
    return [
      { source: "/room", destination: "/room/index.html" },
      { source: "/room/", destination: "/room/index.html" },
    ];
  },

  async headers() {
    return [
      {
        // Baked lightmaps, textures, geometry and the vendored three.js build.
        // These only change when the scene is re-baked, so a returning visitor
        // should download none of them.
        source: "/room/:dir(assets|libs)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Application code changes more often than the assets do.
        source: "/room/:path*.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
