"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { money, timestamp } from "@/lib/format";
import { StatusBadge, KpiCard, VerdictRing } from "@/components/ui";

const IconDoc = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3v5h5" />
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6z" />
  </svg>
);
const IconCheck = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13l4 4L19 7" />
  </svg>
);
const IconClock = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconX = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export default function Dashboard() {
  const [runs, setRuns] = useState([]);
  const [pos, setPos] = useState([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [h, p] = await Promise.all([
        fetch("/api/history").then((r) => r.json()),
        fetch("/api/pos").then((r) => r.json()),
      ]);
      setRuns(h.runs || []);
      setPos(p.purchaseOrders || []);
    } catch {
      /* server warming up */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const counts = useMemo(() => {
    const by = (s) => runs.filter((r) => r.status === s).length;
    return {
      total: runs.length,
      approved: by("APPROVED"),
      pending: by("PENDING_REVIEW"),
      rejected: by("REJECTED") + by("MANUAL_ENTRY_REQUIRED"),
    };
  }, [runs]);

  const feed = useMemo(
    () => [...runs].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [runs]
  );

  const approvalRate = counts.total ? Math.round((counts.approved / counts.total) * 100) : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[30px] font-semibold tracking-tight">Command center</h1>
            <span className="live-pill">
              <span className="h-1.5 w-1.5 rounded-full bg-approve dot-pulse" />
              engine live
            </span>
          </div>
          <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-muted">
            Every invoice the engine has processed this session, live. Drop a PDF in the processor —
            each run lands here with its verdict, and every decision is one click from its full audit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetch("/api/reset", { method: "POST" }).then(refresh)}
            className="btn-ghost text-[12px]"
            title="Wipe session state (history, ledger, PO balances)"
          >
            Reset session
          </button>
          <Link href="/process" className="btn-primary">
            Process invoice
          </Link>
        </div>
      </div>

      {/* ── Row 1 · KPIs + verdict composition ──────────────────────── */}
      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7 xl:col-span-8">
          <KpiCard label="Processed" value={counts.total} tint="var(--ink)" icon={<IconDoc />} delay={0} hint="invoices this session" />
          <KpiCard label="Approved" value={counts.approved} tint="var(--v-approve)" icon={<IconCheck />} delay={40} hint={approvalRate != null ? `${approvalRate}% approval rate` : "clean matches & tax tolerance"} />
          <KpiCard label="Pending review" value={counts.pending} tint="var(--v-pending)" icon={<IconClock />} delay={80} hint="held for a human decision" />
          <KpiCard label="Rejected" value={counts.rejected} tint="var(--v-reject)" icon={<IconX />} delay={120} hint="duplicates · compliance · closed POs" />
        </div>

        <div className="glass rise flex items-center gap-6 p-5 lg:col-span-5 xl:col-span-4" style={{ animationDelay: "80ms" }}>
          <VerdictRing runs={runs} />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Verdict mix</div>
            {[
              ["APPROVED", "var(--v-approve)", counts.approved, "Approved"],
              ["PENDING_REVIEW", "var(--v-pending)", counts.pending, "Pending review"],
              ["REJECTED", "var(--v-reject)", counts.rejected, "Rejected / manual"],
            ].map(([k, color, v, label]) => (
              <div key={k} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="flex items-center gap-2 text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                  {label}
                </span>
                <span className="font-mono text-[12px] font-medium text-ink">{v}</span>
              </div>
            ))}
            <div className="pt-1.5 text-[11px] leading-relaxed text-faint">
              Rejected includes manual-entry holds — anything the engine refused to pay automatically.
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2 · activity feed + PO ledger ───────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <section className="glass rise overflow-hidden lg:col-span-7 xl:col-span-7" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Activity · latest runs</h2>
            <span className="font-mono text-[10.5px] text-faint">{feed.length} total</span>
          </div>

          {feed.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto flex max-w-md items-center justify-center gap-2 font-mono text-[11px] text-faint">
                <span className="rounded-lg border border-line bg-panel-2 px-2.5 py-1.5">PDF in</span>
                <span className="text-accent">→</span>
                <span className="rounded-lg border border-line bg-panel-2 px-2.5 py-1.5">LLM extract</span>
                <span className="text-accent">→</span>
                <span className="rounded-lg border border-line bg-panel-2 px-2.5 py-1.5">engine verdict</span>
              </div>
              <p className="mx-auto mt-4 max-w-sm text-[13px] leading-relaxed text-faint">
                No runs yet this session. The feed fills in as the engine processes invoices.
              </p>
              <Link href="/process" className="btn-primary mt-5">
                Start the first run
              </Link>
            </div>
          ) : (
            <ul className="slim-scroll max-h-[520px] divide-y divide-line-soft overflow-y-auto">
              {feed.slice(0, 12).map((r) => (
                <li key={r.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-panel-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="truncate text-[13px] font-medium">{r.extracted?.vendorName || r.fileName}</span>
                      <span className="shrink-0 font-mono text-[11px] text-faint">{r.extracted?.invoiceNumber || "no #"}</span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-faint">
                      {r.fileName} · {timestamp(r.createdAt)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-[12.5px] font-medium">{money(r.extracted?.totalAmount)}</div>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={r.status} />
                  </div>
                  <Link
                    href={`/audit/${r.id}`}
                    className="shrink-0 rounded-full border border-line px-3 py-1 font-mono text-[11px] text-muted transition-all hover:border-accent hover:text-ink hover:shadow-[0_0_16px_-4px_rgba(77,141,255,0.5)]"
                  >
                    audit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass rise overflow-hidden lg:col-span-5 xl:col-span-5" style={{ animationDelay: "160ms" }}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">PO ledger · mock ERP</h2>
            <span className="font-mono text-[10.5px] text-faint">{pos.length} POs</span>
          </div>
          <div className="slim-scroll max-h-[520px] space-y-3 overflow-y-auto p-5">
            {!ready ? (
              <div className="shimmer h-16 rounded-xl" />
            ) : pos.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-faint">No PO data.</div>
            ) : (
              pos.map((po) => {
                const pct = po.totalAmount ? Math.round((po.balanceRemaining / po.totalAmount) * 100) : 0;
                const open = po.status === "OPEN";
                return (
                  <div key={po.poNumber} className="glass-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-[12.5px] font-medium text-ink">{po.poNumber}</div>
                        <div className="mt-0.5 truncate text-[12px] text-muted">{po.vendorName}</div>
                      </div>
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                        style={{
                          color: open ? "var(--v-approve)" : "var(--faint)",
                          borderColor: open ? "rgba(52,211,153,0.3)" : "var(--line)",
                          background: open ? "rgba(52,211,153,0.08)" : "transparent",
                        }}
                      >
                        {po.status}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-baseline justify-between text-[11.5px]">
                        <span className="text-faint">
                          balance <span className="font-mono text-muted">{money(po.balanceRemaining)}</span> of {money(po.totalAmount)}
                        </span>
                        <span className="font-mono text-[10.5px] text-faint">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${open ? Math.max(pct, 2) : 0}%`,
                            background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
                            boxShadow: "0 0 10px rgba(77,141,255,0.5)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
