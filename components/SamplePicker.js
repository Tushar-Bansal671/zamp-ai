"use client";

import { useEffect, useState } from "react";
import { SAMPLES } from "@/lib/samples";

const TONE = {
  Approved: "var(--v-approve)",
  "Approved (tax tolerance)": "var(--v-approve)",
  "Rejected (duplicate)": "var(--v-reject)",
  "Rejected (compliance)": "var(--v-reject)",
  "Rejected (closed PO)": "var(--v-reject)",
  "Pending review (PO inferred)": "var(--v-pending)",
};
const toneOf = (label) => TONE[label] || "var(--accent)";

/**
 * A calm, preview-first picker: sample invoices on the left, a live PDF
 * preview on the right, and a single "Load this invoice" action that hands
 * the chosen sample to the upload slot.
 */
export default function SamplePicker({ open, onClose, onPick }) {
  const [active, setActive] = useState(SAMPLES[0].file);

  // Reset to the first sample whenever the modal opens.
  useEffect(() => {
    if (open) setActive(SAMPLES[0].file);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const chosen = SAMPLES.find((s) => s.file === active) || SAMPLES[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-fade" style={{ background: "rgba(24,33,52,0.4)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="modal-pop grid w-full max-w-4xl max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-xl border border-line bg-panel shadow-card md:overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: the list */}
        <div className="flex min-h-0 flex-col border-b border-line md:border-b-0 md:border-r">
          <div className="border-b border-line px-5 py-4">
            <div className="text-[15px] font-semibold">Sample invoices</div>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-faint">
              Pick one to preview, then load it into the processor.
            </p>
          </div>
          <div className="slim-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {SAMPLES.map((s) => {
              const sel = s.file === active;
              return (
                <button
                  key={s.file}
                  onClick={() => setActive(s.file)}
                  className={`mb-1.5 flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                    sel ? "bg-panel-2" : "border-transparent hover:border-line hover:bg-panel-2"
                  }`}
                  style={sel ? { borderColor: "rgba(47,107,255,0.45)", background: "var(--panel-2)" } : undefined}
                >
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: toneOf(s.expect), opacity: sel ? 1 : 0.55 }}
                  />
                  <span className="min-w-0">
                    <span className={`block truncate text-[13px] ${sel ? "text-ink" : "text-muted"}`}>{s.label}</span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">
                      {s.invoice} · {s.vendor}
                    </span>
                    <span className="mt-1 inline-block rounded px-1.5 py-px font-mono text-[10px] uppercase tracking-wide" style={{ color: toneOf(s.expect) }}>
                      {s.expect}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: preview + action */}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="truncate text-[13px] font-medium">{chosen.label}</span>
            <span className="font-mono text-[10.5px] uppercase tracking-wide" style={{ color: toneOf(chosen.expect) }}>
              {chosen.expect}
            </span>
          </div>
          <div className="relative min-h-0 flex-1" style={{ background: "var(--term-bg)" }}>
            <iframe
              key={chosen.file}
              src={`/samples/${encodeURIComponent(chosen.file)}`}
              title={chosen.file}
              className="h-full w-full"
              style={{ minHeight: 340, border: 0 }}
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            <button onClick={onClose} className="rounded-sm px-3 py-2 text-[12.5px] text-faint transition-colors hover:text-ink">
              Cancel
            </button>
            <button
              onClick={() => onPick(chosen.file)}
              className="btn-primary px-4 py-2 text-[13px]"
            >
              Load this invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
