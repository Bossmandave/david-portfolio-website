import { describe, expect, it } from "vitest";

import { RingBuffer } from "@/core/signal/ring-buffer";

describe("RingBuffer", () => {
  it("reads back in insertion order before wrapping", () => {
    const buffer = new RingBuffer(4);
    buffer.push(1);
    buffer.push(2);

    expect(buffer.length).toBe(2);
    expect(buffer.at(0)).toBe(1);
    expect(buffer.at(1)).toBe(2);
    expect(buffer.latest).toBe(2);
  });

  it("drops the oldest sample once full", () => {
    const buffer = new RingBuffer(3);
    [1, 2, 3, 4, 5].forEach((v) => buffer.push(v));

    expect(buffer.length).toBe(3);
    expect([buffer.at(0), buffer.at(1), buffer.at(2)]).toEqual([3, 4, 5]);
    expect(buffer.latest).toBe(5);
  });

  it("reports extent across the retained window only", () => {
    const buffer = new RingBuffer(3);
    [100, 2, 3, 4].forEach((v) => buffer.push(v));

    // 100 has been evicted, so it must not influence the scope's axis.
    expect(buffer.extent()).toEqual({ min: 2, max: 4 });
  });

  it("ignores non-finite samples when scaling", () => {
    const buffer = new RingBuffer(4);
    [1, Number.NaN, Number.POSITIVE_INFINITY, 5].forEach((v) => buffer.push(v));

    expect(buffer.extent()).toEqual({ min: 1, max: 5 });
  });

  it("returns neutral values when empty", () => {
    const buffer = new RingBuffer(4);

    expect(buffer.length).toBe(0);
    expect(buffer.latest).toBe(0);
    expect(buffer.at(0)).toBe(0);
    expect(buffer.extent()).toEqual({ min: 0, max: 0 });
  });
});
