"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { StatusBadge, ExtractionSummary } from "@/components/ui";
import { money, timestamp } from "@/lib/format";

export default function AuditPage() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [po, setPo] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/history/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("404"))))
      .then((j) => {
        setRun(j.run);
        if (j.run?.extracted?.poNumber) {
          fetch("/api/pos")
            .then((r) => r.json())
            .then((p) => setPo((p.purchaseOrders || []).find((x) => x.poNumber === j.run.extracted.poNumber) || null))
            .catch(() => {});
        }
      })
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-center lg:px-8">
        <div className="text-[16px] font-medium">That audit record does not exist.</div>
        <p className="mt-1 text-[13px] text-muted">It may have been cleared, or the server restarted since the run.</p>
        <Link href="/" className="btn-ghost mt-5 font-mono text-[12px]">← Back to the dashboard</Link>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto grid max-w-6xl place-items-center px-5 py-24 text-center lg:px-8">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 rounded-full border-2 border-accent spin-ring" style={{ borderTopColor: "transparent" }} />
          <div className="font-mono text-[12px] text-faint">Loading audit…</div>
        </div>
      </div>
    );
  }

  const verdict = run.status;
  const suggested = run.suggestedPO || null;

  const engineSteps = (run.logs || []).map((l) => ({
    title: `${l.step}. ${l.message}`,
    detail: l.detail,
    level: { PASS: "PASS", FAIL: "FAIL", NOTE: "NOTE" }[l.status] || "INFO",
    sub: l.status === "NOTE" ? "inference" : "rule",
  }));

  const showPO = po || suggested;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
      {/* ── Verdict hero ──────────────────────────────────────────── */}
      <div className="glass verdict-glow rise p-6 sm:p-7" data-verdict={verdict}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={verdict} size="lg" />
              <span className="font-mono text-[11px] text-faint">{run.id}</span>
              <span className="font-mono text-[11px] text-faint">{timestamp(run.createdAt)}</span>
            </div>
            <h1 className="mt-3.5 text-[24px] font-semibold tracking-tight">{run.extracted?.invoiceNumber || run.fileName}</h1>
            <div className="mt-1 text-[13.5px] text-muted">{run.extracted?.vendorName || "Unknown vendor"}</div>
            <p className="mt-3 max-w-2xl whitespace-pre-line text-[13.5px] leading-relaxed text-muted">{run.summary}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2.5">
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-widest text-faint">amount</div>
              <div className="text-[26px] font-semibold tracking-tight">{money(run.extracted?.totalAmount)}</div>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/process" className="btn-primary text-[12.5px]" style={{ padding: "8px 14px" }}>Process another</Link>
              <Link href="/" className="btn-ghost font-mono text-[11.5px]" style={{ padding: "8px 14px" }}>Dashboard</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Split audit ───────────────────────────────────────────── */}
      <div className="rise mt-4 grid gap-4 lg:grid-cols-2" style={{ animationDelay: "90ms" }}>
        {/* Source document */}
        <section className="glass flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Source document</span>
            <span className="font-mono text-[11px] text-muted">{run.fileName}</span>
          </div>
          <div className="min-h-[480px] flex-1" style={{ background: "var(--term-bg)" }}>
            <iframe src={run.pdfUrl || ""} title="Invoice PDF" className="h-full w-full" style={{ minHeight: 480, border: 0 }} />
          </div>
        </section>

        {/* Extraction + reasoning + PO */}
        <section className="flex flex-col gap-4">
          <div className="glass p-5">
            <ExtractionSummary data={run.extracted} />
          </div>

          <div className="glass p-5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">Reasoning log</span>
              {run.extractionSource ? (
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-accent">
                  extraction · {run.extractionSource}
                </span>
              ) : null}
            </div>
            <ol className="mt-4 space-y-3">
              {engineSteps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[13px] leading-relaxed">
                  <span
                    className="mt-px shrink-0 font-mono text-[12px] font-semibold"
                    style={{
                      color:
                        s.level === "PASS"
                          ? "var(--v-approve)"
                          : s.level === "FAIL"
                          ? "var(--v-reject)"
                          : s.level === "NOTE"
                          ? "var(--v-pending)"
                          : "var(--muted)",
                    }}
                  >
                    {s.level === "PASS" ? "✓" : s.level === "FAIL" ? "✕" : "»"}
                  </span>
                  <div className="min-w-0">
                    <span className="text-ink">{s.title}</span>
                    {s.detail ? <div className="mt-0.5 text-[12px] text-faint">{s.detail}</div> : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {showPO ? (
            <div className="glass p-5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
                {po ? "Matched PO" : "Suggested PO"}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <KV k="PO" v={(po || suggested)?.poNumber || "—"} />
                <KV k="Vendor" v={(po || suggested)?.vendorName || "—"} />
                <KV k="Total" v={money((po || suggested)?.totalAmount)} />
                <KV k="Tax (PO)" v={money((po || suggested)?.taxAmount)} />
                <KV k="Status" v={(po || suggested)?.status || "—"} />
                <KV k="Balance" v={money((po || suggested)?.balanceRemaining)} />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div className="glass-2 flex items-baseline justify-between gap-3 rounded-lg px-3.5 py-2.5">
      <span className="shrink-0 text-[11.5px] text-faint">{k}</span>
      <span className="truncate font-mono text-[12.5px] text-ink" title={String(v)}>{v}</span>
    </div>
  );
}
