"use client";

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-start gap-2.5 text-left focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-signal"
    >
      <span
        aria-hidden
        className={`mt-[3px] h-3 w-3 shrink-0 border transition-colors ${
          checked
            ? "border-signal bg-signal"
            : "border-line-bright bg-transparent group-hover:border-ink-dim"
        }`}
      />
      <span className="min-w-0">
        <span className="tabular block text-[11px] tracking-[0.14em] text-ink-dim uppercase transition-colors group-hover:text-ink">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-ink-faint">
          {hint}
        </span>
      </span>
    </button>
  );
}
