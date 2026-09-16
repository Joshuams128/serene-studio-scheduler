"use client";

import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { Card } from "./ui";

/* ---------------------------------------------------------------------------
   Sections that fold away. The dashboard is a tall single column, and most of
   it — the weekly template especially — is set once and then only scrolled
   past. Each section remembers whether it was open, per browser.
--------------------------------------------------------------------------- */

const KEY = (id: string) => `serene-scheduler-open-${id}`;

function read(id: string): boolean | null {
  try {
    const v = window.localStorage.getItem(KEY(id));
    return v === null ? null : v === "1";
  } catch {
    return null; // private mode or site data blocked — just use the default
  }
}

function write(id: string, open: boolean) {
  try {
    window.localStorage.setItem(KEY(id), open ? "1" : "0");
  } catch {
    /* not remembering is fine */
  }
}

function subscribeNothing() {
  return () => {};
}

/**
 * Read the stored state through useSyncExternalStore so the server renders the
 * default and the client settles on hydration — no mismatch, no extra pass.
 */
export function usePersistedOpen(
  id: string,
  defaultOpen: boolean
): [boolean, (next: boolean) => void] {
  const stored = useSyncExternalStore(
    subscribeNothing,
    () => read(id),
    () => null
  );
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? stored ?? defaultOpen;

  return [
    open,
    (next: boolean) => {
      write(id, next);
      setOverride(next);
    },
  ];
}

/**
 * Same idea as usePersistedOpen, but for a set of ids — used for the draft's
 * week groups, where the number of groups changes as the category filter
 * changes and so can't be one hook per group.
 */
export function usePersistedSet(
  id: string
): [Set<string>, (next: Set<string>) => void] {
  const stored = useSyncExternalStore(
    subscribeNothing,
    () => {
      try {
        return window.localStorage.getItem(KEY(id));
      } catch {
        return null;
      }
    },
    () => null
  );
  const [override, setOverride] = useState<string | null>(null);
  const raw = override ?? stored;

  let value: Set<string>;
  try {
    value = new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    value = new Set<string>();
  }

  return [
    value,
    (next: Set<string>) => {
      const serialised = JSON.stringify([...next]);
      try {
        window.localStorage.setItem(KEY(id), serialised);
      } catch {
        /* not remembering is fine */
      }
      setOverride(serialised);
    },
  ];
}

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 8"
      aria-hidden
      className={`h-2.5 w-2.5 shrink-0 transition-transform duration-200 ${
        open ? "" : "-rotate-90"
      }`}
    >
      <path
        d="M1 1.5 6 6.5l5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function CollapsibleCard({
  id,
  eyebrow,
  title,
  description,
  action,
  summary,
  defaultOpen = true,
  children,
}: {
  /** Stable key used to remember open/closed. */
  id: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Buttons shown beside the title — only while open. */
  action?: ReactNode;
  /** Short stand-in shown when collapsed, e.g. "70 entries". */
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = usePersistedOpen(id, defaultOpen);
  const panelId = `section-${id}`;

  return (
    <Card>
      <div
        className={`flex flex-wrap items-end justify-between gap-4 px-6 py-5 ${
          open ? "border-b border-mist/40" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
          className="-m-2 min-w-0 flex-1 rounded-xl p-2 text-left transition-colors hover:bg-paper"
        >
          {eyebrow && <p className="eyebrow mb-1.5 text-sage">{eyebrow}</p>}
          <span className="flex items-center gap-2 text-ink">
            <Chevron open={open} />
            <span className="text-xl font-normal tracking-tight md:text-[1.375rem]">
              {title}
            </span>
          </span>
          {open
            ? description && (
                <p className="mt-1.5 max-w-2xl text-sm font-light leading-relaxed text-fern">
                  {description}
                </p>
              )
            : summary && (
                <span className="mt-1.5 block text-sm font-light text-sage">
                  {summary}
                </span>
              )}
        </button>
        {open && action && (
          <div className="flex shrink-0 items-center gap-2">{action}</div>
        )}
      </div>
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </Card>
  );
}
