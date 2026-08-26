import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./ui";

/**
 * Sticky white header mirroring the nav on serenepilates.ca — white surface,
 * hairline sage rule, generous height.
 */
export default function SiteHeader({
  subtitle = "Scheduler",
  href = "/",
  right,
}: {
  subtitle?: string;
  href?: string | null;
  right?: ReactNode;
}) {
  const brand = <Logo size={44} subtitle={subtitle} />;

  return (
    <header className="sticky top-0 z-50 border-b border-mist/25 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {href ? (
          <Link href={href} className="transition-opacity hover:opacity-75">
            {brand}
          </Link>
        ) : (
          brand
        )}
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}
