"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { money, timestamp } from "@/lib/format";
import { StatusBadge } from "@/components/ui";

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

  const stats = useMemo(() => {
    const by = (s) => runs.filter((r) => r.status === s).length;
    return [
      { label: "Processed", value: runs.length, color: "var(--ink)" },
      { label: "Approved", value: by("APPROVED"), color: "var(--v-approve)" },
      { label: "Pending review", value: by("PENDING_REVIEW"), color: "var(--v-pending)" },
      { label: "Rejected", value: by("REJECTED") + by("MANUAL_ENTRY_REQUIRED"), color: "var(--v-reject)" },
    ];
  }, [runs]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* Title row */}
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Invoice queue</h1>
          <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-muted">
            Every invoice the engine has processed this session. Open the processor to upload one —
            it also ships with sample invoices you can preview and run.
          </p>
        </div>
        <Link
          href="/process"
          className="btn-primary"
        >
          Process a new invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="rise mt-6 grid grid-cols-2 gap-3 md:grid-cols-4" style={{ animationDelay: "60ms" }}>
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border border-line bg-panel p-4 shadow-card">
            <div className="font-mono text-[11px] text-faint">{s.label}</div>
            <div className="mt-1.5 text-[30px] font-semibold leading-none tracking-tight" style={{ color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* History table */}
      <section className="rise mt-8" style={{ animationDelay: "120ms" }}>
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
          Processed invoices
        </h2>
        <div className="mt-3 overflow-hidden rounded-md border border-line bg-panel shadow-card">
          {runs.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="text-[15px] font-medium text-muted">No invoices processed yet this session.</div>
              <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-faint">
                Upload a PDF in the processor, or start from one of the built-in sample invoices —
                the table fills in as the engine runs.
              </p>
              <Link href="/process" className="btn-primary mt-5">
                Open the processor
              </Link>
            </div>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Vendor</th>
                  <th className="hidden px-4 py-2.5 font-medium sm:table-cell">PO</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Decision</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-line-soft last:border-0 transition-colors hover:bg-panel-2">
                    <td className="px-4 py-3">
                      <div className="font-mono text-[12.5px]">{r.extracted?.invoiceNumber || "—"}</div>
                      <div className="mt-0.5 text-[11px] text-faint">{r.fileName}</div>
                    </td>
                    <td className="px-4 py-3 text-muted">{r.extracted?.vendorName || "—"}</td>
                    <td className="hidden px-4 py-3 font-mono text-[12px] text-muted sm:table-cell">
                      {r.extracted?.poNumber || "inferred"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[12.5px]">
                      {money(r.extracted?.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-faint">{timestamp(r.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/audit/${r.id}`}
                        className="rounded-sm border border-line px-2.5 py-1 font-mono text-[11.5px] text-muted transition-colors hover:border-accent hover:text-ink"
                      >
                        Audit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Mock ERP */}
      <section className="rise mt-8" style={{ animationDelay: "180ms" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
            Purchase orders · mock ERP
          </h2>
          <button
            onClick={() => fetch("/api/reset", { method: "POST" }).then(refresh)}
            className="rounded-sm border border-line px-2.5 py-1 font-mono text-[11px] text-faint transition-colors hover:border-reject hover:text-reject"
            title="Wipe session state (history, ledger, PO balances)"
          >
            Reset session
          </button>
        </div>
        <div className="mt-3 overflow-hidden rounded-md border border-line bg-panel shadow-card">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
                <th className="px-4 py-2.5 font-medium">PO</th>
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 text-right font-medium">Total</th>
                <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                <th className="px-4 py-2.5 text-right font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {(pos.length ? pos : Array(8).fill(null)).map((po, i) =>
                po ? (
                  <tr key={po.poNumber} className="border-b border-line-soft last:border-0">
                    <td className="px-4 py-2 font-mono text-[12px]">{po.poNumber}</td>
                    <td className="px-4 py-2 pr-3 text-muted">{po.vendorName}</td>
                    <td className="px-4 py-2 text-right font-mono text-[12px]">{money(po.totalAmount)}</td>
                    <td className="px-4 py-2 text-right font-mono text-[12px] text-muted">{money(po.balanceRemaining)}</td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className="font-mono text-[10.5px] uppercase tracking-wide"
                        style={{ color: po.status === "OPEN" ? "var(--v-approve)" : "var(--faint)" }}
                      >
                        {po.status}
                      </span>
                    </td>
                  </tr>
                ) : (
                  <tr key={i} className="py-2">
                    <td className="px-4 text-faint" colSpan={5}>
                      {ready ? "No PO data." : "Loading…"}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
