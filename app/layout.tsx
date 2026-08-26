import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is the face used across serenepilates.ca — self-hosted by next/font
// so the scheduler matches the studio site without a Google round-trip.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Serene Pilates · Scheduler",
    template: "%s · Serene Pilates",
  },
  description:
    "Instructor availability and monthly class scheduling for Serene Pilates.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full bg-paper font-sans text-ink">{children}</body>
    </html>
  );
}
