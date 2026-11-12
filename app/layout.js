import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "Zamp PS-1 · Invoice Decision Engine",
  description:
    "Zamp Problem Statement 1 — automated vendor invoice processing: LLM extraction, PO cross-reference, deterministic approval rules, and a full audit trail.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
