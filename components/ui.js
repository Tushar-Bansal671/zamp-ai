"use client";

import { useEffect, useRef } from "react";

/** Glass command-center UI primitives. */

const STATUS_STYLES = {
  APPROVED: { color: "var(--v-approve)", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", label: "Approved" },
  PENDING_REVIEW: { color: "var(--v-pending)", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", label: "Pending review" },
  REJECTED: { color: "var(--v-reject)", bg: "rgba(251,113,133,0.1)", border: "rgba(251,113,133,0.3)", label: "Rejected" },
  MANUAL_ENTRY_REQUIRED: { color: "var(--v-manual)", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.3)", label: "Manual entry" },
};

export function StatusBadge({ status, size = "md" }) {
  const meta = STATUS_STYLES[status] || STATUS_STYLES.MANUAL_ENTRY_REQUIRED;
  const pad = size === "lg" ? "px-3.5 py-1 text-[12.5px]" : "px-2.5 py-0.5 text-[11px]";
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border font-mono font-medium uppercase tracking-wide ${pad}`}
      style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.border }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
      />
      {meta.label}
    </span>
  );
}

const LOG_TONE = {
  PASS: { color: "var(--term-approve)", marker: "✓" },
  FAIL: { color: "var(--term-fail)", marker: "✕" },
  NOTE: { color: "var(--term-note)", marker: "»" },
  INFO: { color: "var(--term-mute)", marker: "›" },
};

export function LogLine({ log }) {
  const tone = LOG_TONE[log.level] || LOG_TONE.INFO;
  return (
    <div className="line-in flex gap-2.5 px-4 py-1.5 font-mono text-[12.5px] leading-relaxed">
      <span style={{ color: tone.color }} className="w-4 shrink-0 text-center font-semibold">
        {tone.marker}
      </span>
      <div className="min-w-0">
        <div>
          {log.sub ? (
            <span
              className="mr-1.5 rounded border border-line bg-panel-2 px-1.5 py-px text-[10px]"
              style={{ color: "var(--term-mute)" }}
            >
              {log.sub}
            </span>
          ) : null}
          <span style={{ color: tone.color }}>{log.title}</span>
        </div>
        {log.detail ? (
          <div className="text-[11.5px]" style={{ color: "var(--term-mute)" }}>
            {log.detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Terminal({ logs, running, title = "Execution console" }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [logs.length, running]);

  return (
    <div className="glass flex h-full flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
          </div>
          <span className="ml-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">{title}</span>
        </div>
        {running ? (
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--term-approve)" }}>
            <span className="h-1.5 w-1.5 rounded-full dot-pulse" style={{ background: "var(--term-approve)", boxShadow: "0 0 8px var(--term-approve)" }} />
            streaming
          </span>
        ) : null}
      </div>
      <div ref={boxRef} className="slim-scroll min-h-0 flex-1 overflow-y-auto" style={{ background: "var(--term-bg)" }}>
        {logs.length === 0 ? (
          <div className="px-4 py-3 font-mono text-[12.5px]" style={{ color: "var(--term-mute)" }}>
            {running
              ? "Waiting for the first step…"
              : "The console logs every engine step as it happens. Upload an invoice to begin."}
          </div>
        ) : (
          logs.map((l, i) => <LogLine key={i} log={l} />)
        )}
        {running ? (
          <div className="flex items-center gap-2 px-4 py-2 font-mono text-[12.5px]" style={{ color: "var(--term-mute)" }}>
            <span className="cursor-blink" style={{ color: "var(--term-ink)" }}>
              ▍
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function KeyVal({ k, children, mono = true }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2 text-[13px] last:border-0">
      <span className="shrink-0 text-faint">{k}</span>
      <span className={`text-right text-ink ${mono ? "font-mono text-[12.5px]" : ""}`}>{children}</span>
    </div>
  );
}

const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/**
 * Plain-language read of the extracted invoice data — what a normal user
 * needs: who, which invoice, when, how much, and which PO it references.
 */
export function ExtractionSummary({ data, title = "Extracted fields" }) {
  if (!data) return null;
  const missing = (v) => (v === null || v === undefined || v === "" ? "Not found on the invoice" : v);
  const fields = [
    ["Vendor", missing(data.vendorName)],
    ["Invoice number", missing(data.invoiceNumber)],
    ["Invoice date", missing(data.date)],
    [
      "Amount due",
      data.totalAmount != null ? moneyFmt.format(data.totalAmount) : "Not found on the invoice",
    ],
    [
      "Tax",
      data.taxAmount != null ? moneyFmt.format(data.taxAmount) : "None shown",
    ],
    [
      "PO reference",
      data.poNumber ? data.poNumber : "None printed — engine infers it",
    ],
    [
      "Line items",
      data.lineItems?.length ? `${data.lineItems.length} item${data.lineItems.length === 1 ? "" : "s"}` : "Not itemized",
    ],
  ];
  return (
    <div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">{title}</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
        {fields.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] text-faint">{k}</dt>
            <dd
              className={`mt-0.5 truncate text-[13px] font-medium ${
                typeof v === "string" && v.startsWith("Not found") ? "italic text-faint font-normal" : "text-ink"
              }`}
              title={typeof v === "string" ? v : undefined}
            >
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** KPI card with a soft tinted icon block. */
export function KpiCard({ label, value, tint, icon, hint, delay = 0 }) {
  return (
    <div className="glass rise p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-faint">{label}</div>
        {icon ? (
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border"
            style={{
              color: tint,
              background: `color-mix(in srgb, ${tint} 10%, transparent)`,
              borderColor: `color-mix(in srgb, ${tint} 25%, transparent)`,
              boxShadow: `0 0 18px -6px ${tint}`,
            }}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-[38px] font-semibold leading-none tracking-tight" style={{ color: tint }}>
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-[12px] text-faint">{hint}</div> : null}
    </div>
  );
}

/** Compact doughnut (SVG) showing verdict share of total runs. */
export function VerdictRing({ runs, size = 168 }) {
  const total = Math.max(runs.length, 1);
  const segs = [
    { status: "APPROVED", color: "var(--v-approve)" },
    { status: "PENDING_REVIEW", color: "var(--v-pending)" },
    { status: "REJECTED", color: "var(--v-reject)" },
    { status: "MANUAL_ENTRY_REQUIRED", color: "var(--v-manual)" },
  ].map((s) => ({ ...s, value: runs.filter((r) => r.status === s.status).length }));

  const r = 62;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-soft)" strokeWidth="12" />
        {runs.length > 0 &&
          segs.map((s) => {
            const frac = s.value / total;
            if (frac === 0) return null;
            const el = (
              <circle
                key={s.status}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${frac * c} ${c}`}
                strokeDashoffset={-offset * c}
                style={{ transition: "stroke-dasharray 0.5s ease" }}
              />
            );
            offset += frac;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[30px] font-semibold leading-none tracking-tight">{runs.length}</div>
          <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">runs</div>
        </div>
      </div>
    </div>
  );
}

/** Tiny sparkline for the activity feed / KPI accents. */
export function Sparkline({ values, color = "var(--accent)", width = 96, height = 28 }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const step = width / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * (height - 4) - 2).toFixed(1)}`);
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle cx={pts[pts.length - 1]?.split(",")[0]} cy={pts[pts.length - 1]?.split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}
