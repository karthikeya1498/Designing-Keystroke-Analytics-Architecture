import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "AegisKey // Typing Behavior & Security Analytics",
  description: "Enterprise Keyboard Event Monitoring, Cryptographic Transmission, and Vertex AI Threat Detection Dashboard.",
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
