/**
 * lib/validate.js — The deterministic decision engine.
 *
 * Takes the LLM-extracted invoice JSON and runs it through a fixed rule
 * sequence against the mock ERP (lib/db.js). No AI is involved in the
 * decision itself — every step here is reproducible and logged, so a human
 * auditor can trace exactly why any invoice got its verdict.
 *
 * Rule sequence (first fatal hit wins):
 *   1. Duplicate check      — invoice number already in the ledger -> REJECTED
 *   2. Vendor approval      — vendor not in the master list        -> REJECTED
 *   3. PO resolution        — explicit poNumber, or fuzzy match on
 *                              (vendor, amount) when the AI found none
 *   4. Amount & variance    — exact match, 8%/18% tax tolerance,
 *                              over-balance, missing amount
 *
 * validateInvoice(invoice, onLog) -> { decision, summary, logs[], suggestedPO, extracted }
 * Each log entry: { step, status: "PASS"|"FAIL"|"SKIP"|"NOTE", message, detail? }
 */

const db = require("./db");

const TAX_RATES = [0.08, 0.18];
const NEAR_ZERO = 0.005;

function isNumber(v) {
  return Number.isFinite(v) && !Number.isNaN(v);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Currency formatting for user-facing summaries (kept here so the engine
// stays dependency-free; mirrors lib/format.js).
const money = (n) => "$" + Number(n || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function validateInvoice(invoice, onLog) {
  const logs = [];
  const log = (entry) => {
    logs.push(entry);
    if (onLog) onLog(entry);
  };

  let decision = "APPROVED";
  let summary = "";
  let suggestedPO = null;

  const finish = (dec, summ) => ({ decision: dec, summary: summ, logs, suggestedPO, extracted: invoice });

  // ---- STEP 1 · duplicate ledger -------------------------------------
  {
    const inv = String(invoice.invoiceNumber || "").toUpperCase();
    const hit = db.duplicateLedger.find((l) => String(l.invoiceNumber).toUpperCase() === inv);
    if (hit) {
      log({
        step: 1,
        status: "FAIL",
        message: "Duplicate invoice detected. Payment halted.",
        detail: `Invoice ${inv} was already processed on ${hit.processedAt}.`,
      });
      return finish("REJECTED", `Duplicate invoice ${inv} — already in the processed ledger.`);
    }
    log({
      step: 1,
      status: "PASS",
      message: "Duplicate check clear.",
      detail: invoice.invoiceNumber
        ? `${invoice.invoiceNumber} not found in ledger (${db.duplicateLedger.length} prior invoices).`
        : "No invoice number extracted — duplicate check could not be run.",
    });
  }

  // ---- STEP 2 · vendor master list ------------------------------------
  {
    const found = db.approvedVendors.some(
      (v) => db.normalizeVendor(v) === db.normalizeVendor(invoice.vendorName)
    );
    if (found) {
      log({ step: 2, status: "PASS", message: "Vendor on the approved master list.", detail: invoice.vendorName });
    } else {
      log({
        step: 2,
        status: "FAIL",
        message: "Vendor not found in master approved list. Compliance risk.",
        detail: `${invoice.vendorName || "(unknown)"} is not an approved vendor.`,
      });
      return finish("REJECTED", `Unapproved vendor (${invoice.vendorName || "unknown"}).`);
    }
  }

  // ---- STEP 3 · resolve the purchase order ----------------------------
  let po = invoice.poNumber ? db.findPO(invoice.poNumber) : null;

  if (po) {
    const vendorMatch =
      db.normalizeVendor(po.vendorName) === db.normalizeVendor(invoice.vendorName);
    if (!vendorMatch) {
      log({
        step: 3,
        status: "FAIL",
        message: "PO / vendor mismatch.",
        detail: `${po.poNumber} belongs to ${po.vendorName}, but the invoice is from ${invoice.vendorName}.`,
      });
      return finish("PENDING_REVIEW", `PO ${po.poNumber} was quoted but belongs to a different vendor.`);
    }
    log({
      step: 3,
      status: "PASS",
      message: `PO ${po.poNumber} resolved (explicit reference).`,
      detail: `${po.poNumber} · ${po.vendorName} · status ${po.status} · balance ${po.balanceRemaining.toFixed(2)}`,
    });
  } else if (String(invoice.poNumber || "").length > 0) {
    // AI quoted a PO number that does not exist.
    const fuzzy = db.findPOByVendorAndAmount(invoice.vendorName, invoice.totalAmount);
    suggestedPO = fuzzy.length === 1 ? fuzzy[0] : null;
    if (fuzzy.length === 1) {
      po = fuzzy[0];
      log({
        step: 3,
        status: "NOTE",
        message: `Suggested PO match found: ${po.poNumber}.`,
        detail: `Quoted reference ${invoice.poNumber} does not exist, but ${po.poNumber} is the unique match on vendor + amount. Held for review.`,
      });
      return finish("PENDING_REVIEW", `Suggested PO match found — ${po.poNumber}.`);
    }
    log({
      step: 3,
      status: "FAIL",
      message: `Unknown PO reference ${invoice.poNumber}.`,
      detail:
          fuzzy.length > 1
          ? `${fuzzy.length} POs match vendor + amount — not unique.`
          : "No PO in the database matches this vendor and amount.",
    });
    return finish("PENDING_REVIEW", `PO reference ${invoice.poNumber} does not exist. No unique fallback match.`);
  } else {
    // Edge case 3: the AI found no PO reference at all — infer it.
    const candidates = db.findPOByVendorAndAmount(invoice.vendorName, invoice.totalAmount);
    suggestedPO = candidates.length === 1 ? candidates[0] : null;
    if (candidates.length === 1) {
      po = candidates[0];
      log({
        step: 3,
        status: "NOTE",
        message: `Suggested PO match found: ${po.poNumber}.`,
        detail: `No PO reference on the invoice; unique match on vendor + amount (${invoice.vendorName}, ${round2(invoice.totalAmount)}). Held for review.`,
      });
      return finish("PENDING_REVIEW", `Suggested PO match found — ${po.poNumber}. Held for human confirmation.`);
    }
    log({
      step: 3,
      status: "FAIL",
      message: "No PO reference on the invoice.",
      detail:
          candidates.length > 1
          ? `${candidates.length} open POs match vendor + amount — not unique, a human must pick.`
          : "No PO in the database matches this vendor and amount.",
    });
    return finish("PENDING_REVIEW", "Missing PO reference and no unique match to infer.");
  }

  // ---- STEP 4 · amount, variance & balance ----------------------------
  const total = invoice.totalAmount;
  if (!isNumber(total)) {
    log({ step: 4, status: "FAIL", message: "Invoice total is missing or not a number.", detail: "Cannot run variance rules." });
    return finish("PENDING_REVIEW", "Total amount missing — manual review required.");
  }

  if (po.status === "CLOSED") {
    log({
      step: 4,
      status: "FAIL",
      message: `PO ${po.poNumber} is already closed.`,
      detail: "A closed purchase order cannot accept new invoices.",
    });
    return finish("REJECTED", `PO ${po.poNumber} is closed — no new charges allowed.`);
  }

  const delta = round2(total - po.totalAmount);
  let acceptedRate = null;
  for (const r of TAX_RATES) {
    if (Math.abs(delta - po.totalAmount * r) < 0.02) acceptedRate = r;
  }

  if (Math.abs(delta) < NEAR_ZERO) {
    // Exact amount match.
    if (!db.poCoversAmount(po, total)) {
      log({ step: 4, status: "FAIL", message: "Invoice exceeds the PO balance.", detail: `Needed ${(total - po.balanceRemaining).toFixed(2)} more than the remaining ${po.balanceRemaining.toFixed(2)}.` });
      return finish(
        "PENDING_REVIEW",
        `The invoice is for ${money(total)}, but the PO still has only ${money(po.balanceRemaining)} available.\nHeld for review.`
      );
    }
    log({ step: 4, status: "PASS", message: "Amount matches the PO exactly.", detail: `Invoice ${money(total)} vs PO ${money(po.totalAmount)}` });
  } else if (acceptedRate !== null) {
    // Edge case 4 — embedded tax tolerance. A recognized 8%/18% uplift is
    // treated as an accepted variance and approved even when it pushes the
    // charge over the remaining balance, so it is checked before the
    // exceeds-balance rule.
    log({
      step: 4,
      status: "PASS",
      message: "Amount variance within recognized tax tolerance.",
      detail: `Δ ${delta.toFixed(2)} equals ${(acceptedRate * 100).toFixed(0)}% tax on ${po.totalAmount.toFixed(2)}.`,
    });
  } else if (!db.poCoversAmount(po, total)) {
    log({
      step: 4,
      status: "FAIL",
      message: "Invoice exceeds the PO balance.",
      detail: `Needed ${money(total - po.balanceRemaining)} more than the remaining ${money(po.balanceRemaining)}.`,
    });
    return finish(
      "PENDING_REVIEW",
      `The invoice is for ${money(total)}, but the PO still has only ${money(po.balanceRemaining)} available.\nHeld for review.`
    );
  } else if (delta > 0) {
    log({
      step: 4,
      status: "FAIL",
      message: "Unexplained amount variance.",
      detail: `Δ ${money(delta)} is not zero and does not equal 8% or 18% tax on the PO.`,
    });
    return finish(
      "PENDING_REVIEW",
      `The invoice is ${money(delta)} higher than the PO total, and that gap is not an explained tax rate.\nHeld for a human to check the discrepancy.`
    );
  } else {
    log({ step: 4, status: "PASS", message: "Invoice is at or under the PO amount.", detail: `Δ ${money(delta)} — within the purchase authorization.` });
  }

  // ---- VERDICT ---------------------------------------------------------
  const charged = Math.min(total, po.balanceRemaining);
  const balanceAfter = po.balanceRemaining - charged;
  db.recordProcessedInvoice(po, invoice);
  log({
    step: 5,
    status: "PASS",
    message: "Approved — ledger and PO balance updated.",
    detail: `${money(charged)} charged to ${po.poNumber}. ${money(balanceAfter)} remaining on that PO. Invoice ${invoice.invoiceNumber || "(no number)"} recorded as paid — resubmissions will be blocked.`,
  });
  // One plain sentence per line, each a single fact a non-accountant can read.
  const lines = [
    `Approved against ${po.poNumber} (${po.vendorName}).`,
    `Charged: ${money(charged)}.`,
    `Remaining on the PO: ${money(balanceAfter)}.`,
    `This invoice is now recorded as paid — sending it again will be blocked.`,
  ];
  if (acceptedRate !== null) lines.splice(1, 0, `Amount includes ${(acceptedRate * 100).toFixed(0)}% tax, which the company recognizes.`);
  return finish("APPROVED", lines.join("\n"));
}

module.exports = { validateInvoice, TAX_RATES };
