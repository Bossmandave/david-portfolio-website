"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { CHANNELS } from "@/content/contact";
import { LIMITS } from "@/lib/validate-contact";
import { AmbientField } from "@/modules/system/AmbientField";
import { Reveal } from "@/modules/system/Reveal";
import { submitContact } from "@/app/signal/actions";
import {
  INITIAL_CONTACT_STATE,
  type ContactState,
} from "@/lib/contact-state";

/** Long enough to read two sentences without hurrying, short enough not to strand. */
const CONFIRMATION_SECONDS = 8;

function Field({
  name,
  label,
  hint,
  error,
  defaultValue,
  multiline,
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  multiline?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const shared = {
    id,
    name,
    defaultValue,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": [error ? errorId : null, hint ? hintId : null]
      .filter(Boolean)
      .join(" ") || undefined,
    className: `mt-2 w-full border bg-panel px-3 py-2.5 font-mono text-[13px] text-ink transition-colors placeholder:text-ink-faint focus:outline-none focus:ring-0 ${
      error
        ? "border-danger focus:border-danger"
        : "border-line-bright focus:border-response"
    }`,
  };

  return (
    <div>
      <label
        htmlFor={id}
        className="font-mono text-[10px] tracking-[0.22em] text-ink-dim uppercase"
      >
        {label}
      </label>

      {multiline ? (
        <textarea {...shared} rows={7} maxLength={LIMITS.message.max} />
      ) : (
        <input {...shared} {...rest} />
      )}

      {hint ? (
        <p id={hintId} className="mt-1.5 text-[11px] text-ink-faint">
          {hint}
        </p>
      ) : null}

      {/* Errors are announced, not merely coloured. A red border communicates
          nothing to a screen reader and nothing to a colourblind reader either. */}
      {error ? (
        <p
          id={errorId}
          className="mt-1.5 font-mono text-[11px] leading-snug text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TransmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="group flex items-center gap-3 border border-response/45 bg-response/8 px-4 py-2.5 font-mono text-[11px] tracking-[0.18em] text-response uppercase transition-colors hover:border-response hover:bg-response/16 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-response disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Transmitting" : "Transmit"}
      <span
        aria-hidden
        className={
          pending
            ? "h-1 w-1 rounded-full bg-response"
            : "transition-transform duration-300 group-hover:translate-x-1"
        }
      >
        {pending ? "" : "→"}
      </span>
    </button>
  );
}

function Confirmation({
  seconds,
  onDismiss,
}: {
  seconds: number;
  onDismiss: () => void;
}) {
  return (
    <div className="border border-response/40 bg-response/5 px-5 py-6">
      <div aria-hidden className="relative h-px w-full overflow-hidden bg-line-bright">
        <span className="absolute inset-y-0 left-0 w-1/3 animate-[sweep_1.1s_ease-out_1] bg-response" />
      </div>
      <p className="mt-5 font-mono text-[11px] tracking-[0.22em] text-response uppercase">
        Transmitted
      </p>
      <p className="mt-3 max-w-[46ch] leading-[1.6] text-ink-dim">
        It reached me. I read everything and reply to anything that isn&rsquo;t a
        recruiter template — usually within a day or two.
      </p>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={onDismiss}
          className="font-mono text-[11px] tracking-[0.16em] text-ink-dim uppercase transition-colors hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-response"
        >
          Send another →
        </button>

        {/* The channel closing. Waiting is never the only way out — the button above
            does it now — but a bar that drains explains why the panel is about to
            disappear, which an unannounced swap does not. */}
        <span
          aria-hidden
          className="relative h-px flex-1 overflow-hidden bg-line"
        >
          <span
            className="absolute inset-0 origin-left bg-response/40"
            style={{ animation: `deplete ${seconds}s linear forwards` }}
          />
        </span>
      </div>
    </div>
  );
}

function ChannelRow({ channel }: { channel: (typeof CHANNELS)[number] }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(channel.value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked by permissions — the link beside it still works.
    }
  };

  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-line py-3">
      <div className="min-w-0">
        <p className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
          {channel.label}
        </p>
        <a
          href={channel.href}
          target={channel.href.startsWith("http") ? "_blank" : undefined}
          rel={channel.href.startsWith("http") ? "noopener noreferrer" : undefined}
          className="mt-1 block truncate font-mono text-[13px] text-ink transition-colors hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-response"
        >
          {channel.value}
        </a>
      </div>

      {channel.copyable ? (
        <button
          type="button"
          onClick={copy}
          className="shrink-0 font-mono text-[10px] tracking-[0.18em] text-ink-faint uppercase transition-colors hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-response"
        >
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      ) : null}
    </li>
  );
}

export function SignalModule() {
  const [state, formAction] = useActionState<ContactState, FormData>(
    submitContact,
    INITIAL_CONTACT_STATE,
  );

  const errors = state.status === "error" ? state.errors : {};
  const values = state.status === "error" ? state.values : undefined;

  /**
   * The confirmation is a message, not a destination — it hands the channel back.
   *
   * Tracked by identity rather than a boolean: the action returns a fresh state object
   * for every submission, so `restoredFor !== state` is true again the moment a second
   * message is sent, with nothing to reset. It also keeps the effect free of a
   * synchronous setState, which would cascade a second render on every state change.
   */
  const [restoredFor, setRestoredFor] = useState<ContactState | null>(null);
  const showConfirmation = state.status === "sent" && restoredFor !== state;

  useEffect(() => {
    if (state.status !== "sent") return;
    const timer = window.setTimeout(
      () => setRestoredFor(state),
      CONFIRMATION_SECONDS * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <div className="relative min-h-dvh bg-void text-ink">
      <AmbientField />

      <main
        id="main"
        className="relative mx-auto max-w-[1120px] px-6 pt-20 pb-28 sm:px-10"
      >
        <Reveal delay={0.1}>
          <p className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
            Module 05 — Signal
          </p>
          <h1 className="mt-4 font-mono text-[clamp(2rem,6vw,3.25rem)] leading-[1.02] font-medium tracking-[-0.03em] text-balance">
            Open a channel
          </h1>
          <p className="mt-6 max-w-[58ch] text-[1.0625rem] leading-[1.6] text-ink-dim">
            This form validates on both sides, rate-limits by origin, announces
            its own errors, and works with JavaScript switched off. Most
            portfolio contact forms do none of those. It seemed like the wrong
            place to make an exception.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Reveal delay={0.26}>
            {showConfirmation ? (
              <Confirmation
                seconds={CONFIRMATION_SECONDS}
                onDismiss={() => setRestoredFor(state)}
              />
            ) : (
              <form action={formAction} noValidate className="space-y-6">
                {/* Announced the moment it appears; the region exists before the
                    error does, because a live region inserted alongside its own
                    content is not reliably read. */}
                <div aria-live="assertive" className="empty:hidden">
                  {errors.form ? (
                    <p className="border border-danger/40 bg-danger/5 px-4 py-3 font-mono text-[11px] leading-relaxed text-danger">
                      {errors.form}
                    </p>
                  ) : null}
                </div>

                <Field
                  name="name"
                  label="Name"
                  autoComplete="name"
                  error={errors.name}
                  defaultValue={values?.name}
                />

                <Field
                  name="email"
                  label="Email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  error={errors.email}
                  defaultValue={values?.email}
                />

                <Field
                  name="message"
                  label="Message"
                  multiline
                  hint={`At least ${LIMITS.message.min} characters. Roles, projects, or an argument about damping ratios.`}
                  error={errors.message}
                  defaultValue={values?.message}
                />

                {/* Honeypot: off-screen rather than display:none, which some bots
                    detect. Hidden from assistive tech and skipped by tabbing. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden"
                >
                  <label htmlFor="company">Company</label>
                  <input id="company" name="company" tabIndex={-1} autoComplete="off" />
                </div>

                <TransmitButton />
              </form>
            )}
          </Reveal>

          <Reveal delay={0.38}>
            <h2 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
              Direct
            </h2>
            <ul className="mt-4 border-t border-line">
              {CHANNELS.map((channel) => (
                <ChannelRow key={channel.id} channel={channel} />
              ))}
            </ul>
            <p className="mt-5 max-w-[34ch] text-[12px] leading-[1.6] text-ink-faint">
              The form needs a delivery endpoint configured before it reaches
              anyone. Email always works.
            </p>
          </Reveal>
        </div>
      </main>
    </div>
  );
}
