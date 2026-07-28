import { FrameStats } from "@/core/signal/frame-stats";
import { FixedClock } from "@/core/time/clock";

/** Runs once per fixed simulation substep. Physics lives here. */
export type SimulateFn = (dt: number) => void;

export interface FrameInfo {
  /** Wall-clock milliseconds since the previous frame. */
  frameMs: number;
  /** Fixed substeps consumed this frame. */
  steps: number;
  /** Fraction of a substep left over, for interpolated rendering. */
  alpha: number;
  /** Seconds since the loop started. */
  elapsed: number;
}

/** Runs once per rendered frame, after simulation. Reads state, writes to the DOM. */
export type RenderFn = (frame: FrameInfo) => void;

/**
 * The single animation loop for the entire application.
 *
 * One `requestAnimationFrame` in the whole app, not one per component. Simulation runs
 * on a fixed timestep so the control loop behaves identically at 60Hz and 144Hz; render
 * runs once per frame. Nothing in here touches React state — subscribers write to refs
 * and to CSS custom properties, so a hundred animating elements cost zero re-renders.
 */
export class Runtime {
  readonly clock: FixedClock;
  readonly stats: FrameStats;

  private readonly simulators = new Set<SimulateFn>();
  private readonly renderers = new Set<RenderFn>();

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private startedAt = 0;
  private running = false;

  constructor(hz = 240, maxSubSteps = 8) {
    this.clock = new FixedClock(hz, maxSubSteps);
    this.stats = new FrameStats();
  }

  onSimulate(fn: SimulateFn): () => void {
    this.simulators.add(fn);
    return () => this.simulators.delete(fn);
  }

  onRender(fn: RenderFn): () => void {
    this.renderers.add(fn);
    return () => this.renderers.delete(fn);
  }

  start(): void {
    if (this.running || typeof window === "undefined") return;
    this.running = true;
    this.lastTimestamp = 0;
    this.startedAt = performance.now();
    this.clock.reset();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  get isRunning(): boolean {
    return this.running;
  }

  private tick = (timestamp: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const frameMs = this.lastTimestamp ? timestamp - this.lastTimestamp : 0;
    this.lastTimestamp = timestamp;
    if (frameMs > 0) this.stats.push(frameMs);

    const steps = this.clock.advance(timestamp);
    const dt = this.clock.dt;

    for (let i = 0; i < steps; i++) {
      for (const simulate of this.simulators) simulate(dt);
    }

    const frame: FrameInfo = {
      frameMs,
      steps,
      alpha: this.clock.alpha,
      elapsed: (timestamp - this.startedAt) / 1000,
    };

    for (const render of this.renderers) render(frame);
  };
}
