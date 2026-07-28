"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/Button";
import { GainSlider } from "@/components/ui/GainSlider";
import { analyseLoop } from "@/core/control/analysis";
import { ringingFromDamping, setAmbientRinging } from "@/engine/gl/ambient-state";
import { createPointerState } from "@/engine/input/pointer";
import { useSimulate } from "@/engine/runtime/RuntimeProvider";
import { useCoarsePointer } from "@/engine/runtime/useCoarsePointer";
import { evaluateChallenge } from "@/modules/control/challenge";
import { ControlContext, useControl } from "@/modules/control/context";
import { Oscilloscope } from "@/modules/control/Oscilloscope";
import { Subject } from "@/modules/control/Subject";
import { DEFAULT_SETTINGS } from "@/modules/control/presets";
import { ControlSystem, type LoopSettings } from "@/modules/control/system";
import { useStepStatus } from "@/modules/control/useStepStatus";
import { AmbientField } from "@/modules/system/AmbientField";
import { Reveal } from "@/modules/system/Reveal";

/* ---------------------------------------------------------------------------------
 * Plain language first, symbols second.
 *
 * A visitor who does not know what a damping ratio is must still be able to read this
 * page and come away understanding what happened. Every number therefore ships with a
 * sentence, and the sentence leads.
 * ------------------------------------------------------------------------------- */

function describeDamping(zeta: number): string {
  if (zeta < 0.3) return "rings for ages before it settles";
  if (zeta < 0.55) return "bounces visibly on the way in";
  if (zeta < 0.85) return "overshoots a little, then settles — confident";
  if (zeta < 1.05) return "arrives without overshooting at all — surgical";
  return "heavy and cautious, slower than it needs to be";
}

function describeSpeed(omegaN: number): string {
  if (omegaN < 10) return "pulls toward the target gently";
  if (omegaN < 20) return "pulls with a firm hand";
  return "yanks toward the target";
}

function Readout({ settings }: { settings: LoopSettings }) {
  const analysis = analyseLoop(settings.gains, settings.plant);
  const tone =
    analysis.stability === "stable"
      ? "text-ink"
      : analysis.stability === "marginal"
        ? "text-warn"
        : "text-danger";

  return (
    <div className="space-y-5">
      <div>
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
            Damping
          </span>
          <span className="font-mono text-[1.375rem] leading-none text-response tabular-nums">
            {analysis.zeta.toFixed(2)}
          </span>
          <span className="font-mono text-[11px] text-ink-faint">ζ</span>
        </p>
        <p className="mt-1.5 text-[13px] leading-snug text-ink-dim">
          {describeDamping(analysis.zeta)}
        </p>
      </div>

      <div>
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
            Speed
          </span>
          <span className="font-mono text-[1.375rem] leading-none text-response tabular-nums">
            {analysis.omegaN.toFixed(1)}
          </span>
          <span className="font-mono text-[11px] text-ink-faint">ωₙ rad/s</span>
        </p>
        <p className="mt-1.5 text-[13px] leading-snug text-ink-dim">
          {describeSpeed(analysis.omegaN)}
        </p>
      </div>

      <div>
        <p className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
            Margin
          </span>
          <span
            className={`font-mono text-[1.375rem] leading-none tabular-nums ${tone}`}
          >
            {Number.isFinite(analysis.stabilityMargin)
              ? `${analysis.stabilityMargin.toFixed(1)}×`
              : "∞"}
          </span>
        </p>
        <p className="mt-1.5 text-[13px] leading-snug text-ink-dim">
          {analysis.stability === "unstable"
            ? "Past the limit. Energy goes in faster than it comes out and the loop runs away."
            : analysis.stability === "marginal"
              ? "Right on the edge. A nudge either way decides it."
              : "How much integral action it could still take before running away."}
        </p>
      </div>

      <p className="border-t border-line pt-4 text-[12px] leading-[1.55] text-ink-faint">
        Damping is read from the real closed loop, not the textbook formula — integral
        action <em className="not-italic text-ink-dim">takes damping away</em>, and the
        approximation everyone quotes does not show it.
      </p>
    </div>
  );
}

function Conditions({ metrics }: { metrics: Parameters<typeof evaluateChallenge>[0] }) {
  const result = evaluateChallenge(metrics);

  return (
    <div>
      <ul className="space-y-px bg-line">
        {result.conditions.map((condition) => (
          <li
            key={condition.id}
            className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-void px-4 py-3"
          >
            <span className="flex items-baseline gap-2.5">
              <span
                aria-hidden
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  result.attempted
                    ? condition.met
                      ? "bg-response"
                      : "bg-danger"
                    : "bg-line-bright"
                }`}
              />
              <span className="text-[13px] text-ink-dim">
                {condition.label}{" "}
                <span className="font-mono text-ink tabular-nums">
                  {condition.target}
                </span>
              </span>
            </span>
            <span
              className={`font-mono text-[13px] tabular-nums ${
                result.attempted
                  ? condition.met
                    ? "text-response"
                    : "text-danger"
                  : "text-ink-faint"
              }`}
            >
              {condition.actual}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 max-w-[54ch] text-[13px] leading-[1.6] text-ink-dim">
        {result.passed
          ? "Tuned. Fast, barely any overshoot, and sitting exactly on target under load — that is the whole job."
          : result.attempted
            ? "Not yet. Each condition needs a different term, and pushing one usually breaks another."
            : "Run a step test to measure the response against the target."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------------- */

const GAIN_KEYS = ["kp", "ki", "kd"] as const;
type GainKey = (typeof GAIN_KEYS)[number];

/**
 * The query string is an external store, read once.
 *
 * The result is cached at module scope because `useSyncExternalStore` compares
 * snapshots by identity — returning a fresh object each call would spin. Reading it
 * through the store rather than in an effect is what keeps the server render and the
 * hydrating client render in agreement: the server snapshot is always `null`, and the
 * shared tune arrives on the controlled re-render straight after.
 */
let cachedUrlGains: LoopSettings["gains"] | null | undefined;

function urlGainsSnapshot(): LoopSettings["gains"] | null {
  if (cachedUrlGains !== undefined) return cachedUrlGains;

  const params = new URLSearchParams(window.location.search);
  const parsed = GAIN_KEYS.map((key) => Number(params.get(key)));
  const [kp, ki, kd] = parsed;

  cachedUrlGains =
    parsed.some((value) => !Number.isFinite(value) || value < 0) ||
    (kp === 0 && ki === 0 && kd === 0)
      ? null
      : { kp, ki, kd };

  return cachedUrlGains;
}

const subscribeNever = () => () => {};
const serverGains = () => null;

function ControlWorkspace({
  settings,
  onGainChange,
  onReset,
}: {
  settings: LoopSettings;
  onGainChange: (key: GainKey, value: number) => void;
  onReset: () => void;
}) {
  const { system } = useControl();
  const { phase, metrics, diverged } = useStepStatus();
  const [copied, setCopied] = useState(false);
  const setGain = onGainChange;

  const shareTune = async () => {
    const params = new URLSearchParams(
      GAIN_KEYS.map((key) => [key, String(settings.gains[key])]),
    );
    const url = `${window.location.origin}${window.location.pathname}?${params}`;

    // Keep the address bar in step with what is being shared, without a navigation.
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable — the URL is in the address bar either way.
    }
  };

  return (
    <>
      <div className="relative min-h-dvh bg-void text-ink">
        <AmbientField />

        <main
          id="main"
          className="relative mx-auto max-w-[1120px] px-6 pt-20 pb-28 sm:px-10"
        >
          <Reveal delay={0.1}>
            <p className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
              Module 04 — Control
            </p>
            <h1 className="mt-4 font-mono text-[clamp(2rem,6vw,3.25rem)] leading-[1.02] font-medium tracking-[-0.03em] text-balance">
              Take the damping out and watch it panic
            </h1>
            <p className="mt-6 max-w-[60ch] text-[1.0625rem] leading-[1.6] text-ink-dim">
              The card below is being held by a control loop — the same one that moves
              everything else on this site. It is chasing a target that keeps moving;
              on a desktop, your pointer takes over the moment you move it. Pull{" "}
              <span className="text-ink">Damping</span> to zero and watch it hunt for
              the target and keep missing. Nothing here is an animation of a control
              system. It is one.
            </p>
          </Reveal>

          <Reveal delay={0.26} className="mt-12">
            <Subject />
          </Reveal>

          <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <Reveal delay={0.34}>
              <h2 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
                Three terms
              </h2>

              <div className="mt-6 space-y-7">
                <GainSlider
                  label="Strength"
                  symbol="kp"
                  hint="How hard it pulls when it's off target. More is faster — and more overshoot."
                  value={settings.gains.kp}
                  min={10}
                  max={1600}
                  step={10}
                  onChange={(v) => setGain("kp", v)}
                  format={(v) => v.toFixed(0)}
                />
                <GainSlider
                  label="Damping"
                  symbol="kd"
                  hint="Resists sudden movement. The only thing stopping it from ringing. Take it to zero."
                  value={settings.gains.kd}
                  min={0}
                  max={300}
                  step={1}
                  onChange={(v) => setGain("kd", v)}
                  format={(v) => v.toFixed(0)}
                />
                <GainSlider
                  label="Patience"
                  symbol="ki"
                  hint="Notices when it has been off target for a while and pushes harder. Without it the card hangs below your cursor forever."
                  value={settings.gains.ki}
                  min={0}
                  max={12000}
                  step={50}
                  onChange={(v) => setGain("ki", v)}
                  format={(v) => v.toFixed(0)}
                />
              </div>

              <div className="mt-8 flex flex-wrap gap-1.5">
                <Button
                  variant="primary"
                  onClick={() => system.beginStepTest()}
                  disabled={phase !== "idle"}
                >
                  {phase === "idle" ? "Run step test" : "Measuring…"}
                </Button>
                <Button variant="ghost" onClick={onReset}>
                  Reset
                </Button>
                <Button variant="ghost" onClick={shareTune}>
                  {copied ? "Link copied" : "Share this tune"}
                </Button>
              </div>

              {diverged ? (
                <p
                  className="mt-5 border border-danger/40 bg-danger/5 px-4 py-3 font-mono text-[11px] leading-relaxed text-danger"
                  aria-live="polite"
                >
                  Diverged. The loop is putting energy in faster than the plant sheds
                  it, so the output has run away. Reset to bring it back.
                </p>
              ) : null}
            </Reveal>

            <Reveal delay={0.42}>
              <h2 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
                What that means
              </h2>
              <div className="mt-6">
                <Readout settings={settings} />
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.5} className="mt-16 border-t border-line pt-12">
            <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <div>
                <h2 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
                  Measured response
                </h2>
                <p className="mt-3 max-w-[54ch] text-[13px] leading-[1.6] text-ink-dim">
                  Commanded position dashed, measured position solid. This is sampled
                  off the running loop — not a drawing of what it should look like.
                </p>
                <div className="mt-5 h-[180px] border border-line bg-panel p-2">
                  <Oscilloscope />
                </div>
              </div>

              <div>
                <h2 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
                  The target
                </h2>
                <p className="mt-3 max-w-[36ch] text-[13px] leading-[1.6] text-ink-dim">
                  Three conditions. Each one needs a different term, which is why they
                  fight.
                </p>
                <div className="mt-5">
                  <Conditions metrics={metrics} />
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.6} className="mt-16 border-t border-line pt-10">
            <p className="max-w-[60ch] text-[13px] leading-[1.65] text-ink-dim">
              The controller behind this is{" "}
              <span className="text-ink">
                back-calculation anti-windup, derivative-on-measurement, output
                saturation
              </span>
              , and its step response is unit-tested against{" "}
              <span className="font-mono text-ink">exp(−πζ/√(1−ζ²))</span>. Stability
              comes from Routh–Hurwitz on the full cubic, so the margin above is exact
              rather than estimated.{" "}
              <Link
                href="/lab/control"
                className="text-response underline decoration-response/30 underline-offset-4 transition-colors hover:decoration-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-response"
              >
                The full instrument is here
              </Link>{" "}
              if you want every knob, including the ones that break it.
            </p>
          </Reveal>
        </main>
      </div>
    </>
  );
}

/**
 * Owns the loop; the workspace consumes it.
 *
 * The split exists because a component cannot read a context it is itself providing —
 * the readouts need `useControl`, so they have to live one level below the provider.
 */
export function ControlModule() {
  const [system] = useState(() => new ControlSystem(DEFAULT_SETTINGS));
  const [pointer] = useState(() => createPointerState());
  const [context] = useState(() => ({ system, pointer }));
  const coarsePointer = useCoarsePointer();

  const sharedGains = useSyncExternalStore(
    subscribeNever,
    urlGainsSnapshot,
    serverGains,
  );

  // `null` means "nothing chosen yet", so a tune shared by URL survives until the
  // first slider moves rather than being overwritten on hydration.
  const [chosen, setChosen] = useState<LoopSettings["gains"] | null>(null);
  const gains = chosen ?? sharedGains ?? DEFAULT_SETTINGS.gains;

  const settings = useMemo<LoopSettings>(
    () => ({
      gains,
      plant: { ...DEFAULT_SETTINGS.plant },
      options: { ...DEFAULT_SETTINGS.options },
    }),
    [gains],
  );

  useEffect(() => {
    system.applySettings(settings);
  }, [system, settings]);

  // Publish how much the loop being tuned overshoots, so the ambient field takes on
  // the same character. Detuning the module detunes the background with it — the
  // shader is inside the loop rather than illustrating it.
  useEffect(() => {
    const analysis = analyseLoop(settings.gains, settings.plant);
    setAmbientRinging(ringingFromDamping(analysis.zeta));
    return () => setAmbientRinging(null);
  }, [settings]);

  const clock = useRef(0);

  /**
   * The setpoint drives itself until a cursor takes over.
   *
   * On touch there is no hovering pointer to command it, so a stage waiting for one
   * is simply dead — the visitor moves the sliders and nothing appears to happen. The
   * loop therefore sweeps a slow path of its own, and hands control to the pointer the
   * moment a real one shows up. Desktop gets the same behaviour for free: the module
   * demonstrates itself on arrival instead of waiting to be discovered.
   */
  useSimulate((dt) => {
    clock.current += dt;

    // A cursor commands by hovering; a finger commands by touching. Asking a finger
    // to hover is why the stage was inert on a phone.
    const commanding = coarsePointer ? pointer.pressed : pointer.active;

    if (commanding) {
      system.setTarget(pointer.x, pointer.y);
    } else {
      const { width, height } = system.bounds;
      if (width > 0 && height > 0) {
        const t = clock.current;
        system.setTarget(
          width * (0.5 + 0.3 * Math.sin(t * 0.62)),
          height * (0.5 + 0.24 * Math.sin(t * 0.41 + 1.2)),
        );
      }
    }

    system.simulate(dt);
  });

  return (
    <ControlContext.Provider value={context}>
      <ControlWorkspace
        settings={settings}
        onGainChange={(key, value) =>
          setChosen({ ...gains, [key]: value })
        }
        onReset={() => {
          setChosen({ ...DEFAULT_SETTINGS.gains });
          system.reset();
        }}
      />
    </ControlContext.Provider>
  );
}
