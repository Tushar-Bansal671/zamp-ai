"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/process", label: "Process invoice" },
];

export default function Header() {
  const path = usePathname();

  const nav = (p) =>
    p === "/"
      ? "text-ink font-semibold"
      : path.startsWith(p)
      ? "text-ink font-semibold"
      : "text-muted hover:text-ink";

  return (
    <header className="sticky top-0 z-20 border-b border-line backdrop-blur">
      <div
        className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5"
        style={{ background: "rgba(255,255,255,0.92)" }}
      >
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="grid h-6 w-6 place-items-center rounded-[7px] font-mono text-[13px] font-semibold"
              style={{ background: "var(--ink)", color: "#fff" }}
            >
              z
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Zamp PS-1<span className="text-faint"> · </span>
              <span className="text-muted font-medium">Invoice Decision Engine</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 font-mono text-[12px] tracking-wide transition-colors ${nav(n.href)}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 font-mono text-[11px] text-faint md:flex">
            <span className="dot-pulse h-1.5 w-1.5 rounded-full" style={{ background: "var(--v-approve)" }} />
            engine live
          </span>
          <Link href="/process" className="btn-primary text-[13px]" style={{ padding: "8px 14px" }}>
            Process invoice
          </Link>
        </div>
      </div>
    </header>
  );
}
