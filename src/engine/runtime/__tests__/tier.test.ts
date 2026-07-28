import { describe, expect, it } from "vitest";

import { decideTier, type DeviceCapabilities } from "@/engine/runtime/tier";

const desktop: DeviceCapabilities = {
  webgl2: true,
  reducedMotion: false,
  saveData: false,
  coarsePointer: false,
  memoryGb: 16,
  cores: 12,
};

describe("decideTier", () => {
  it("gives a capable desktop the full effect", () => {
    expect(decideTier(desktop)).toBe(2);
  });

  it("drops to CSS when there is no WebGL2 at all", () => {
    expect(decideTier({ ...desktop, webgl2: false })).toBe(0);
  });

  it("treats reduced motion and Save-Data as requests, not hints", () => {
    // A workstation that asked for less still gets less.
    expect(decideTier({ ...desktop, reducedMotion: true })).toBe(0);
    expect(decideTier({ ...desktop, saveData: true })).toBe(0);
  });

  it("assumes a phone budget for coarse pointers", () => {
    expect(decideTier({ ...desktop, coarsePointer: true })).toBe(1);
  });

  it("steps down on thin memory or few cores", () => {
    expect(decideTier({ ...desktop, memoryGb: 2 })).toBe(1);
    expect(decideTier({ ...desktop, cores: 2 })).toBe(1);
  });

  it("does not punish browsers that withhold hardware details", () => {
    // Safari reports neither deviceMemory nor a useful core count. Treating absence
    // as failure would demote every Apple device for a privacy decision.
    const withheld = { ...desktop, memoryGb: undefined, cores: undefined };
    expect(decideTier(withheld)).toBe(2);
  });

  it("puts preference ahead of capability", () => {
    const weakButWilling = {
      ...desktop,
      memoryGb: 2,
      cores: 2,
      reducedMotion: true,
    };
    expect(decideTier(weakButWilling)).toBe(0);
  });
});
