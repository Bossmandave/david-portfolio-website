"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "chip";

const VARIANTS: Record<Variant, string> = {
  primary:
    "border-signal/45 bg-signal/8 text-signal hover:bg-signal/16 hover:border-signal",
  ghost:
    "border-line-bright text-ink-dim hover:border-ink-faint hover:text-ink",
  chip: "border-line-bright text-ink-dim hover:border-signal/60 hover:text-signal",
};

export function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`tabular border px-2.5 py-1.5 text-[11px] tracking-[0.14em] uppercase transition-colors focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-signal disabled:cursor-not-allowed disabled:opacity-35 ${VARIANTS[variant]} ${className}`}
    />
  );
}
