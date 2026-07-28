import { RingBuffer } from "@/core/signal/ring-buffer";

/**
 * Rolling frame-time statistics.
 *
 * Mean FPS is a comfortable lie — a loop that renders 58 frames in 950ms and then stalls
 * for 50ms still reports "60fps" while feeling broken. p95 frame time and a dropped-frame
 * count are what actually correlate with whether motion feels smooth, so those are what
 * get reported.
 *
 * Percentiles sort a scratch copy, so `percentile()` is called at readout rate (a few Hz)
 * rather than per frame.
 */
export class FrameStats {
  private readonly samples: RingBuffer;
  private readonly scratch: Float32Array;

  /** Frames whose duration exceeded the budget since the last reset. */
  droppedFrames = 0;
  totalFrames = 0;

  constructor(
    readonly capacity = 240,
    /** A 60Hz frame has 16.67ms; anything past this missed its deadline. */
    readonly budgetMs = 17,
  ) {
    this.samples = new RingBuffer(capacity);
    this.scratch = new Float32Array(capacity);
  }

  push(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    this.samples.push(frameMs);
    this.totalFrames++;
    if (frameMs > this.budgetMs) this.droppedFrames++;
  }

  get length(): number {
    return this.samples.length;
  }

  get meanMs(): number {
    const n = this.samples.length;
    if (n === 0) return 0;
    let total = 0;
    for (let i = 0; i < n; i++) total += this.samples.at(i);
    return total / n;
  }

  get fps(): number {
    const mean = this.meanMs;
    return mean > 0 ? 1000 / mean : 0;
  }

  /** @param p 0..1 */
  percentile(p: number): number {
    const n = this.samples.length;
    if (n === 0) return 0;

    const view = this.scratch.subarray(0, n);
    for (let i = 0; i < n; i++) view[i] = this.samples.at(i);
    view.sort();

    const index = Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
    return view[index];
  }

  /** Share of recent frames that missed the budget, 0..1. */
  get dropRate(): number {
    const n = this.samples.length;
    if (n === 0) return 0;
    let missed = 0;
    for (let i = 0; i < n; i++) {
      if (this.samples.at(i) > this.budgetMs) missed++;
    }
    return missed / n;
  }

  reset(): void {
    this.samples.clear();
    this.droppedFrames = 0;
    this.totalFrames = 0;
  }
}
