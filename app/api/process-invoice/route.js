/**
 * POST /api/process-invoice — the engine pipeline.
 *
 * Body: multipart form with a single "file" field (the invoice PDF).
 *
 * Response: an NDJSON stream (one JSON event per line) so the frontend can
 * render each step live:
 *   { type: "run", fileName, size }
 *   { type: "log", step, title, level, detail? }
 *   { type: "extraction", source, data, note? }
 *   { type: "decision", decision, summary }
 *   { type: "done", id }
 *   { type: "error", message }
 */

import { NextResponse } from "next/server";
import { extractInvoiceFromPDF } from "@/lib/extract";
import { validateInvoice } from "@/lib/validate";
import { addRun } from "@/lib/results";

export const dynamic = "force-dynamic";

function emit(writer, event) {
  writer.write(`\n${JSON.stringify(event)}\n`);
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing file upload (form field: 'file')." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const fileName = file.name || "upload.pdf";
    if (!/\.pdf$/i.test(fileName) && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF invoices are accepted." }, { status: 415 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const w = {
          write: (s) => controller.enqueue(encoder.encode(s)),
          close: () => controller.close(),
        };

        emit(w, { type: "run", fileName, size: bytes.length });

        // STEP 1 · ingestion ------------------------------------------------
        emit(w, {
          type: "log",
          step: 1,
          title: "Invoice ingested.",
          level: "PASS",
          detail: `${fileName} · ${bytes.length.toLocaleString()} bytes · ${file.type || "application/pdf"}`,
        });

        // STEP 2 · LLM extraction -------------------------------------------
        emit(w, { type: "log", step: 2, title: "Extracting invoice data via LLM…", level: "INFO" });
        const extraction = await extractInvoiceFromPDF(bytes);
        if (extraction.data) {
          const e = extraction.data;
          emit(w, {
            type: "log",
            step: 2,
            title: `Extraction complete (${extraction.source}).`,
            level: "PASS",
            detail: [
              e.invoiceNumber || "no invoice #",
              e.vendorName || "vendor?",
              e.poNumber || "no PO ref",
              e.totalAmount != null ? `total ${e.totalAmount}` : "total ?",
            ].join(" · "),
          });
          if (extraction.note) {
            emit(w, { type: "log", step: 2, title: extraction.note, level: "NOTE" });
          }
          emit(w, { type: "extraction", source: extraction.source, data: e, note: extraction.note || null });
        }

        // STEP 3 · validation engine ------------------------------------------
        let verdict = { decision: "MANUAL_ENTRY_REQUIRED", summary: "Extraction failed — no usable invoice data.", logs: [] };
        if (extraction.data) {
          emit(w, { type: "log", step: 3, title: "Running validation engine…", level: "INFO" });
          verdict = validateInvoice(extraction.data, (engineLog) => {
            const mapped = { PASS: "PASS", FAIL: "FAIL", NOTE: "NOTE", SKIP: "INFO" }[engineLog.status] || "INFO";
            emit(w, {
              type: "log",
              step: 3,
              title: engineLog.message,
              level: mapped,
              detail: engineLog.detail,
              sub: engineLog.step ? `rule ${engineLog.step}` : undefined,
            });
          });
        } else {
          emit(w, {
            type: "log",
            step: 3,
            title: "Validation skipped — extraction produced no data.",
            level: "FAIL",
            detail: extraction.note || "The PDF could not be parsed. Enter the invoice details manually.",
          });
        }

        emit(w, { type: "decision", decision: verdict.decision, summary: verdict.summary });

        // Persist for the dashboard + audit view.
        const record = addRun(
          {
            fileName,
            status: verdict.decision,
            summary: verdict.summary,
            extracted: verdict.extracted,
            logs: verdict.logs,
            suggestedPO: verdict.suggestedPO,
            extractionSource: extraction.source,
            extractionNote: extraction.note || null,
          },
          bytes.toString("base64")
        );
        emit(w, { type: "done", id: record.id });
        w.close();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  } catch (err) {
    // The app must never crash: return a clean error log to the UI.
    const body = new TextEncoder().encode(
      `\n${JSON.stringify({ type: "error", message: err.message || String(err) })}\n`
    );
    return new Response(body, {
      status: 500,
      headers: { "content-type": "application/x-ndjson" },
    });
  }
}
