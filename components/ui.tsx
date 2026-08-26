import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";

/* ---------------------------------------------------------------------------
   Small shared primitives so every screen uses the same Serene Pilates
   surfaces, buttons and fields instead of one-off Tailwind strings.
--------------------------------------------------------------------------- */

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* --- Brand mark ---------------------------------------------------------- */

export function Logo({
  size = 44,
  withWordmark = true,
  subtitle,
}: {
  size?: number;
  withWordmark?: boolean;
  subtitle?: string;
}) {
  return (
    <span className="flex items-center gap-3">
      <Image
        src="/images/serene-logo.png"
        alt="Serene Pilates"
        width={size}
        height={size}
        className="shrink-0"
      />
      {withWordmark && (
        <span className="leading-tight">
          <span className="block text-[1.0625rem] font-light tracking-tight text-ink">
            Serene Pilates
          </span>
          {subtitle && (
            <span className="block text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-sand">
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

/* --- Buttons ------------------------------------------------------------- */

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

const BUTTON_VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-clay text-shell shadow-sm hover:bg-clay-deep active:bg-clay-deep border border-transparent",
  secondary:
    "bg-shell text-fern border border-mist hover:border-sage hover:text-ink hover:bg-paper",
  ghost:
    "bg-transparent text-fern border border-transparent hover:bg-paper hover:text-ink",
  danger:
    "bg-transparent text-[#a4442c] border border-[#a4442c]/30 hover:bg-[#a4442c]/8 hover:border-[#a4442c]/60",
};

const BUTTON_SIZES: Record<NonNullable<ButtonProps["size"]>, string> = {
  // Minimum heights keep these comfortably tappable on a phone.
  sm: "px-3 py-2 text-sm rounded-lg min-h-[2.25rem]",
  md: "px-4 py-2.5 text-sm rounded-xl min-h-[2.75rem]",
  lg: "px-6 py-3 text-base rounded-xl min-h-[3rem]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-45",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
    />
  );
}

/* --- Surfaces ------------------------------------------------------------ */

export function Card({
  className,
  children,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      {...props}
      className={cx(
        "rounded-2xl border border-mist/50 bg-shell shadow-[0_1px_2px_rgba(40,53,23,0.04),0_8px_24px_-16px_rgba(40,53,23,0.18)]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-mist/40 px-6 py-5">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5 text-sage">{eyebrow}</p>}
        <h2 className="text-xl font-normal tracking-tight text-ink md:text-[1.375rem]">
          {title}
        </h2>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm font-light leading-relaxed text-fern">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

/* --- Form fields --------------------------------------------------------- */

const FIELD_BASE =
  "w-full rounded-xl border border-mist/70 bg-white px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-sage/70 transition-colors hover:border-sage focus:border-clay " +
  "focus:outline-none focus:ring-2 focus:ring-clay/15 disabled:bg-paper disabled:text-fern";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input {...props} className={cx(FIELD_BASE, className)} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea {...props} className={cx(FIELD_BASE, "resize-y", className)} />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cx(FIELD_BASE, "cursor-pointer appearance-none bg-white pr-8", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5 6 6.5l5-5' stroke='%23606C37' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.75rem center",
        backgroundSize: "0.7rem",
        ...props.style,
      }}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-sage">{hint}</span>}
    </label>
  );
}

/* --- Status ------------------------------------------------------------- */

type Tone = "sand" | "sage" | "clay" | "mist" | "alert";

const TONES: Record<Tone, string> = {
  sand: "bg-peach/30 text-[#8a5a1c] border-sand/40",
  sage: "bg-mist/25 text-fern-deep border-mist/60",
  clay: "bg-clay/10 text-clay border-clay/25",
  mist: "bg-paper text-sage border-mist/50",
  alert: "bg-[#a4442c]/8 text-[#a4442c] border-[#a4442c]/25",
};

export function Badge({
  tone = "mist",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Note({
  tone = "sage",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border px-4 py-3 text-sm font-light leading-relaxed",
        TONES[tone]
      )}
    >
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-6 py-10 text-center text-sm font-light text-sage">
      {children}
    </p>
  );
}
