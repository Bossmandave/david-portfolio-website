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
  allowedDevOrigins: ["192.168.1.193", "*.local"],
};

export default nextConfig;
