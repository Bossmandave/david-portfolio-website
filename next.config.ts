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
};

export default nextConfig;
