import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studio Scheduler",
  description: "Instructor availability and schedule drafting tool",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 font-sans">{children}</body>
    </html>
  );
}
