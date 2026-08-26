"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui";

/**
 * A short click-through tour of the dashboard. Runs itself the first time an
 * owner lands here, and is replayable any time from the ? in the header.
 *
 * Each step optionally names an element id: that element is scrolled into view
 * and ringed while the step is showing. There's deliberately no dimming
 * backdrop — a ring plus the card reads clearly on the cream palette and can't
 * be defeated by a stacking context somewhere up the tree.
 */

export type TourStep = {
  /** id of the element to highlight; omit for a full-width intro/outro step. */
  target?: string;
  title: string;
  body: string;
};

const STORAGE_KEY = "serene-scheduler-tour-seen-v1";
const HIGHLIGHT_CLASS = "tour-highlight";

/** Has this browser already been shown the tour? Storage can throw. */
export function hasSeenTour(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "yes";
  } catch {
    // Private mode, or site data blocked — treat as "not seen" and just don't
    // remember. Better to show it twice than never.
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "yes");
  } catch {
    /* nothing to do — the tour simply won't be remembered */
  }
}

/**
 * Rendered only while the tour is running — the caller mounts and unmounts it.
 * That keeps the step counter self-resetting and lets the highlight effect's
 * own cleanup take the ring off the page, with no reset or teardown effects.
 */
export default function Tour({
  steps,
  onClose,
}: {
  steps: TourStep[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);

  const finish = useCallback(() => {
    markSeen();
    onClose();
  }, [onClose]);

  // Ring the current step's element and bring it into view.
  useEffect(() => {
    const id = steps[index]?.target;
    if (!id) return;

    const el = document.getElementById(id);
    if (!el) return;

    el.classList.add(HIGHLIGHT_CLASS);
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => el.classList.remove(HIGHLIGHT_CLASS);
  }, [index, steps]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight")
        setIndex((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length, finish]);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Dashboard tour"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-5 sm:pb-8"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-mist/60 bg-shell p-5 shadow-[0_8px_40px_-8px_rgba(40,53,23,0.35)]">
        <div className="flex items-center justify-between gap-4">
          <span className="eyebrow text-sand">
            Step {index + 1} of {steps.length}
          </span>
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-5 bg-clay" : "w-1.5 bg-mist"
                }`}
              />
            ))}
          </div>
        </div>

        <h3 className="mt-3 text-lg font-medium tracking-tight text-ink">
          {step.title}
        </h3>
        <p className="mt-1.5 text-sm font-light leading-relaxed text-fern">
          {step.body}
        </p>

        <div className="mt-5 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            {isLast ? "Close" : "Skip tour"}
          </Button>
          <span className="flex-1" />
          {index > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIndex((i) => i - 1)}
            >
              Back
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
          >
            {isLast ? "Got it" : "Next tip"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The ? button that replays the tour. */
export function TourButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Show me around the dashboard"
      title="Show me around"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-mist text-sm font-medium text-fern transition-colors hover:border-clay hover:bg-clay hover:text-shell"
    >
      ?
    </button>
  );
}
