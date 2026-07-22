import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Order State Machine — Gametime",
  description:
    "Take-home assessment: state-machine-backed order lifecycle with stage-dependent failure recovery.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
