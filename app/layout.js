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
  title: "Ledgerline · Invoice Decision Engine",
  description:
    "Vendor invoice automation — LLM extraction, PO cross-reference, and deterministic approval rules with a full audit trail.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg font-sans text-ink antialiased">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
