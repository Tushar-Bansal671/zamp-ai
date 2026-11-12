/**
 * lib/store.js — Mock data store for the Invoice Decision Engine.
 *
 * Simulates a company ERP: open/closed purchase orders, the master list of
 * approved vendors, and a duplicate-invoice ledger (the "processed" log).
 *
 * The store lives on `globalThis`, not in module-level variables, so that
 * every API route instance in the Next dev server shares ONE store. (The dev
 * server bundles each route separately; a plain module would give each route
 * its own copy, so the dashboard's PO table could diverge from what the
 * engine actually validated against — and dev hot-reloads would reset it.)
 */

const SEED = {
  purchaseOrders: [
    {
      poNumber: "PO-2024-0417",
      vendorName: "Nimbus Tech Supply Co.",
      totalAmount: 12450.0,
      taxAmount: 0.0,
      status: "OPEN",
      balanceRemaining: 12450.0,
      notes: "Networking hardware — quarterly refresh",
    },
    {
      poNumber: "PO-2024-0512",
      vendorName: "Helios Office Solutions",
      totalAmount: 3875.5,
      taxAmount: 0.0,
      status: "OPEN",
      balanceRemaining: 3875.5,
      notes: "Ergonomic workstations, HQ floor 2",
    },
    {
      poNumber: "PO-2024-0603",
      vendorName: "Aurora Legal LLP",
      totalAmount: 22000.0,
      taxAmount: 0.0,
      status: "OPEN",
      balanceRemaining: 11000.0,
      notes: "Q2 retainer, split settlement",
    },
    {
      poNumber: "PO-2024-0788",
      vendorName: "Northbridge Logistics Ltd.",
      totalAmount: 840.0,
      taxAmount: 0.0,
      status: "CLOSED",
      balanceRemaining: 0.0,
      notes: "Already settled — 44-07",
    },
    {
      poNumber: "PO-2024-0901",
      vendorName: "Vertex Manufacturing Inc.",
      totalAmount: 15780.0,
      taxAmount: 0.0,
      status: "OPEN",
      balanceRemaining: 15780.0,
      notes: "Tooling run, batch 12",
    },
    {
      poNumber: "PO-2024-0902",
      vendorName: "Nimbus Tech Supply Co.",
      totalAmount: 9800.0,
      taxAmount: 0.0,
      status: "OPEN",
      balanceRemaining: 9800.0,
      notes: "Support & licensing — annual",
    },
    {
      poNumber: "PO-2024-7777",
      vendorName: "Helios Office Solutions",
      totalAmount: 2145.2,
      taxAmount: 0.0,
      status: "OPEN",
      balanceRemaining: 2145.2,
      notes: "Office refresh — external upload demo",
    },
    {
      poNumber: "PO-1402",
      vendorName: "Metro Facilities Corp",
      totalAmount: 4000.0,
      taxAmount: 0.0,
      status: "OPEN",
      balanceRemaining: 4000.0,
      notes: "Facility maintenance — external upload demo",
    },
  ],
  approvedVendors: [
    "Nimbus Tech Supply Co.",
    "Helios Office Solutions",
    "Aurora Legal LLP",
    "Northbridge Logistics Ltd.",
    "Vertex Manufacturing Inc.",
    "CoreStack Software GmbH",
    "Metro Facilities Corp",
  ],
  // Previously processed invoice numbers (seeded so the duplicate path is
  // demonstrable out of the box). New results are appended by the engine.
  duplicateLedger: [
    { invoiceNumber: "INV-2024-0031", processedAt: "2024-08-02T09:14:00.000Z" },
  ],
};

// Reuse the existing store on this process; create it only on first use.
const store = globalThis.__ledgerline_db || (globalThis.__ledgerline_db = JSON.parse(JSON.stringify(SEED)));

/** Normalizes a vendor name for fuzzy comparison. */
function normalizeVendor(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findPO(poNumber) {
  if (!poNumber) return null;
  return store.purchaseOrders.find((p) => p.poNumber === String(poNumber).toUpperCase()) || null;
}

function findPOByVendorAndAmount(vendorName, totalAmount) {
  const key = normalizeVendor(vendorName);
  return store.purchaseOrders.filter((po) => {
    const poVendor = normalizeVendor(po.vendorName);
    const vendorOk =
      poVendor === key ||
      (poVendor.length >= 6 && (poVendor.includes(key) || key.includes(poVendor)));
    const amountOk =
      Number.isFinite(totalAmount) && Math.abs(po.totalAmount - totalAmount) < 0.005;
    return vendorOk && amountOk;
  });
}

/**
 * Applies the invoice to the ledger (happy path): decrements the PO balance
 * and records the invoice number so a re-submission is rejected as duplicate.
 * Returns the updated PO or null.
 */
function recordProcessedInvoice(po, invoice) {
  if (po) {
    const charged = Math.min(invoice.totalAmount || 0, po.balanceRemaining);
    po.balanceRemaining = Math.max(0, po.balanceRemaining - charged);
  }
  store.duplicateLedger.push({
    invoiceNumber: invoice.invoiceNumber,
    processedAt: new Date().toISOString(),
  });
  return po;
}

/** True if the PO still has enough room for the new invoice amount. */
function poCoversAmount(po, amount) {
  return Number.isFinite(amount) && po.balanceRemaining >= amount - 0.005;
}

function resetStore() {
  store.purchaseOrders.length = 0;
  store.approvedVendors.length = 0;
  store.duplicateLedger.length = 0;
  const seed = JSON.parse(JSON.stringify(SEED));
  store.purchaseOrders.push(...seed.purchaseOrders);
  store.approvedVendors.push(...seed.approvedVendors);
  store.duplicateLedger.push(...seed.duplicateLedger);
}

module.exports = {
  get purchaseOrders() {
    return store.purchaseOrders;
  },
  get approvedVendors() {
    return store.approvedVendors;
  },
  get duplicateLedger() {
    return store.duplicateLedger;
  },
  normalizeVendor,
  findPO,
  findPOByVendorAndAmount,
  recordProcessedInvoice,
  poCoversAmount,
  resetStore,
};
