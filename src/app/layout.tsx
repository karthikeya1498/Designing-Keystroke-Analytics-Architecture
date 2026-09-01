import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AegisKey // Typing Behavior & Security Analytics",
  description: "Browser-based keystroke analytics prototype with encrypted event envelopes, bounded ingestion, and explicitly synthetic security scenarios.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
