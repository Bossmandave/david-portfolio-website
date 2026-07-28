/**
 * Fixed-capacity circular buffer over a Float32Array.
 *
 * The scope pushes a sample every frame and never stops, so this has to be allocation
 * free in steady state — a growing array here would hand the garbage collector a
 * predictable frame-time spike every few seconds.
 */
export class RingBuffer {
  private readonly data: Float32Array;
  private head = 0;
  private filled = 0;

  constructor(readonly capacity: number) {
    this.data = new Float32Array(capacity);
  }

  push(value: number): void {
    this.data[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.filled < this.capacity) this.filled++;
  }

  /** Index 0 is the oldest retained sample. */
  at(index: number): number {
    if (index < 0 || index >= this.filled) return 0;
    const start = this.filled === this.capacity ? this.head : 0;
    return this.data[(start + index) % this.capacity];
  }

  get length(): number {
    return this.filled;
  }

  get latest(): number {
    return this.filled === 0
      ? 0
      : this.data[(this.head - 1 + this.capacity) % this.capacity];
  }

  /** Min and max across retained samples, for auto-scaling the scope's vertical axis. */
  extent(): { min: number; max: number } {
    if (this.filled === 0) return { min: 0, max: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < this.filled; i++) {
      const v = this.at(i);
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    if (min === Infinity) return { min: 0, max: 0 };
    return { min, max };
  }

  clear(): void {
    this.data.fill(0);
    this.head = 0;
    this.filled = 0;
  }
}
