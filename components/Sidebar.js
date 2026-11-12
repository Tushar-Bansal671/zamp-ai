"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Icons — minimal inline SVG, no external deps. */
const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);
const IconProcess = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);
const IconAudit = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
    <path d="M8.5 11h5" />
    <path d="M11 8.5v5" />
  </svg>
);

const NAV = [
  { href: "/", label: "Dashboard", tip: "Dashboard · runs & verdicts", icon: <IconDashboard /> },
  { href: "/process", label: "Process", tip: "Process a new invoice", icon: <IconProcess /> },
];

export default function Sidebar() {
  const path = usePathname();
  const isActive = (p) => (p === "/" ? path === "/" : path.startsWith(p));

  return (
    <>
      {/* Mobile / tablet top bar */}
      <div className="lg:hidden sticky top-0 z-40 border-b border-line backdrop-blur-xl" style={{ background: "rgba(5,7,12,0.82)" }}>
        <div className="flex h-14 items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-[15px] font-semibold tracking-tight text-ink">
              Zamp PS-1
              <span className="text-faint"> · </span>
              <span className="text-muted font-medium hidden sm:inline">Invoice Decision Engine</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 font-mono text-[12px] transition-colors ${
                  isActive(n.href) ? "text-ink bg-panel-2" : "text-muted hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop rail */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-16 flex-col items-center border-r border-line py-5 backdrop-blur-2xl" style={{ background: "rgba(5,7,12,0.68)" }}>
        {/* Brand */}
        <Link href="/" data-tip="Dashboard" className="rail-item group mb-2 flex h-11 w-11 items-center justify-center">
          <span
            className="grid h-11 w-11 place-items-center rounded-2xl font-mono text-[20px] font-bold text-white transition-transform group-hover:scale-105"
            style={{
              background: "var(--grad)",
              boxShadow: "0 8px 24px -6px rgba(77,141,255,0.55), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            z
          </span>
        </Link>

        <div className="mb-4 h-px w-8 bg-line" />

        {/* Nav */}
        <nav className="flex flex-col items-center gap-2.5">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              data-tip={n.tip}
              className={`rail-item grid h-11 w-11 place-items-center rounded-xl transition-all ${
                isActive(n.href)
                  ? "bg-accent-soft text-ink shadow-[0_0_20px_-4px_rgba(77,141,255,0.55)]"
                  : "text-faint hover:bg-panel-2 hover:text-ink"
              }`}
              style={isActive(n.href) ? { border: "1px solid rgba(77,141,255,0.4)" } : undefined}
            >
              {n.icon}
              {isActive(n.href) ? (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent dot-pulse" />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Engine status */}
        <div className="rail-item flex h-11 w-11 flex-col items-center justify-center gap-1 text-approve" data-tip="Engine · live">
          <span className="h-2 w-2 rounded-full bg-approve shadow-[0_0_10px_2px_rgba(52,211,153,0.6)] dot-pulse" />
          <span className="font-mono text-[8px] uppercase tracking-widest text-faint">live</span>
        </div>
      </aside>
    </>
  );
}

function BrandMark() {
  return (
    <span
      className="grid h-7 w-7 place-items-center rounded-lg font-mono text-[13px] font-bold text-white"
      style={{
        background: "var(--grad)",
        boxShadow: "0 4px 14px -4px rgba(77,141,255,0.6)",
      }}
    >
      z
    </span>
  );
}
