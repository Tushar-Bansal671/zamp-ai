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
      <div className="mx-auto max-w-6xl px-5 py-16 text-center">
        <div className="text-[16px] font-medium">That audit record does not exist.</div>
        <p className="mt-1 text-[13px] text-muted">
          It may have been cleared, or the server may have restarted since the run.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-sm border border-line px-3.5 py-2 font-mono text-[12px] text-muted hover:border-accent hover:text-ink"
        >
          ← Back to the dashboard
        </Link>
      </div>
    );
  }

  if (!run) {
    return <div className="mx-auto max-w-6xl px-5 py-16 text-center text-[13px] text-faint">Loading audit…</div>;
  }

  const verdict = run.status;
  const suggested = run.suggestedPO || null;

  const engineSteps = (run.logs || []).map((l) => ({
    title: `${l.step}. ${l.message}`,
    detail: l.detail,
    level: { PASS: "PASS", FAIL: "FAIL", NOTE: "NOTE" }[l.status] || "INFO",
    sub: l.status === "NOTE" ? "inference" : "rule",
  }));

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* Verdict banner */}
      <div
        className="rise flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-panel p-5 shadow-card"
        style={{ borderColor: verdictBorder(verdict) }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={verdict} />
            <span className="font-mono text-[11.5px] text-faint">{run.id}</span>
            <span className="text-[12px] text-faint">{timestamp(run.createdAt)}</span>
          </div>
          <h1 className="mt-2.5 text-[19px] font-semibold tracking-tight">
            {run.extracted?.invoiceNumber || run.fileName}
          </h1>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">{run.summary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/process"
            className="btn-primary px-3 py-1.5 text-[12.5px]"
          >
            Process another
          </Link>
          <Link
            href="/"
            className="rounded-sm border border-line px-3 py-1.5 font-mono text-[11.5px] text-muted hover:text-ink"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Split-screen audit */}
      <div className="rise mt-5 grid gap-4 lg:grid-cols-2" style={{ animationDelay: "90ms" }}>
        {/* Left: source document */}
        <section className="flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Source document</span>
            <span className="font-mono text-[11px] text-faint">{run.fileName}</span>
          </div>
          <div className="min-h-[480px] flex-1 bg-[#0b0e12]">
            <iframe src={run.pdfUrl || ""} title="Invoice PDF" className="h-full w-full" style={{ minHeight: 480, border: 0 }} />
          </div>
        </section>

        {/* Right: extraction + reasoning */}
        <section className="flex flex-col gap-4">
          <div className="rounded-md border border-line bg-panel p-4 shadow-card">
            <div className="px-1">
              <ExtractionSummary data={run.extracted} title="What we found on this invoice" />
            </div>
          </div>

          <div className="rounded-md border border-line bg-panel p-4 shadow-card">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Reasoning log</h2>
            <ol className="mt-3 space-y-2.5">
              {engineSteps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
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
                  <div>
                    <span className="text-ink">{s.title}</span>
                    {s.detail ? <div className="text-[12px] text-faint">{s.detail}</div> : null}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {(po || suggested) ? (
            <div className="rounded-md border border-line bg-panel p-4 shadow-card">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                {(po && "Matched PO") || (suggested && "Suggested PO")}
              </h2>
              <div className="mt-3 space-y-0 text-[13px]">
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
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-1.5 last:border-0">
      <span className="text-[12px] text-faint">{k}</span>
      <span className="font-mono text-[12.5px] text-ink">{v}</span>
    </div>
  );
}

function verdictBorder(d) {
  return {
    APPROVED: "rgba(65,207,143,0.35)",
    PENDING_REVIEW: "rgba(227,168,60,0.35)",
    REJECTED: "rgba(229,72,77,0.35)",
    MANUAL_ENTRY_REQUIRED: "rgba(167,139,250,0.35)",
  }[d] || "var(--line)";
}
