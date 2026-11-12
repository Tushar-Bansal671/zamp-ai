"use client";

import { useEffect, useRef } from "react";

/** Minimal, consistent UI primitives for the dashboard. */

const STATUS_STYLES = {
  APPROVED: { color: "var(--v-approve)", bg: "rgba(65,207,143,0.10)", label: "Approved" },
  PENDING_REVIEW: { color: "var(--v-pending)", bg: "rgba(227,168,60,0.10)", label: "Pending review" },
  REJECTED: { color: "var(--v-reject)", bg: "rgba(229,72,77,0.10)", label: "Rejected" },
  MANUAL_ENTRY_REQUIRED: { color: "var(--v-manual)", bg: "rgba(167,139,250,0.10)", label: "Manual entry" },
};

export function StatusBadge({ status }) {
  const meta = STATUS_STYLES[status] || STATUS_STYLES.MANUAL_ENTRY_REQUIRED;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide"
      style={{ color: meta.color, backgroundColor: meta.bg, borderColor: meta.color + "44" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  );
}

const LOG_TONE = {
  PASS: { color: "var(--v-approve)", marker: "✓" },
  FAIL: { color: "var(--v-reject)", marker: "✕" },
  NOTE: { color: "var(--v-pending)", marker: "»" },
  INFO: { color: "var(--muted)", marker: "›" },
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
          {log.sub ? <span className="mr-1.5 rounded-sm bg-panel-2 px-1 py-px text-[10px] text-faint">{log.sub}</span> : null}
          <span style={{ color: tone.color }}>{log.title}</span>
        </div>
        {log.detail ? <div className="text-[11.5px] text-faint">{log.detail}</div> : null}
      </div>
    </div>
  );
}

export function Terminal({ logs, running }) {
  const boxRef = useRef(null);
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [logs.length, running]);

  return (
    <div ref={boxRef} className="slim-scroll h-full overflow-y-auto bg-[#0b0e12]">
      {logs.length === 0 ? (
        <div className="px-4 py-3 font-mono text-[12.5px] text-faint">
          {running
            ? "Waiting for the first step…"
            : "The execution terminal logs every engine step as it happens."}
        </div>
      ) : (
        logs.map((l, i) => <LogLine key={i} log={l} />)
      )}
      {running ? (
        <div className="flex items-center gap-2 px-4 py-2 font-mono text-[12.5px] text-faint">
          <span className="dot-pulse">●</span> running
          <span className="cursor-blink">▍</span>
        </div>
      ) : null}
    </div>
  );
}

export function KeyVal({ k, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2 text-[13px] last:border-0">
      <span className="shrink-0 text-faint">{k}</span>
      <span className="text-right text-ink">{children}</span>
    </div>
  );
}

const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/**
 * Plain-language read of the extracted invoice data — what a normal user
 * needs: who, which invoice, when, how much, and which PO it references.
 */
export function ExtractionSummary({ data, title = "What we found on this invoice" }) {
  if (!data) return null;
  const missing = (v) => (v === null || v === undefined || v === "" ? "Not found on the invoice" : v);
  const fields = [
    ["Vendor", missing(data.vendorName)],
    ["Invoice number", missing(data.invoiceNumber)],
    ["Invoice date", missing(data.date)],
    [
      "Amount due",
      data.totalAmount != null
        ? moneyFmt.format(data.totalAmount)
        : "Not found on the invoice",
    ],
    [
      "Tax",
      data.taxAmount != null
        ? moneyFmt.format(data.taxAmount)
        : "None shown",
    ],
    [
      "PO reference",
      data.poNumber ? data.poNumber : "None printed — engine infers it",
    ],
    [
      "Line items",
      data.lineItems?.length
        ? `${data.lineItems.length} item${data.lineItems.length === 1 ? "" : "s"}`
        : "Not itemized",
    ],
  ];
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">{title}</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {fields.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11.5px] text-faint">{k}</dt>
            <dd
              className={`mt-0.5 truncate text-[13px] ${
                typeof v === "string" && v.startsWith("Not found") ? "text-faint italic" : "text-ink"
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
