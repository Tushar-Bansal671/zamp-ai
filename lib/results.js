/**
 * lib/results.js — History of every processed invoice (the dashboard ledger).
 *
 * The store lives on `globalThis`, not in a module-level variable, so that:
 *   1. Every API route instance shares the SAME store (the Next dev server
 *      bundles each route separately; a plain module would give each route
 *      its own copy, so /api/history/[id] could not see runs written by
 *      /api/process-invoice — the "audit record does not exist" bug).
 *   2. Next's dev-time hot-reload (which re-imports modules on file changes)
 *      does NOT wipe the history, because globalThis survives HMR.
 *
 * PDF bytes are kept in a side map so the history list payloads stay small;
 * they are served back via /api/run-file.
 */

function createStore() {
  return {
    seq: 0,
    runs: [], // full records, newest first
    files: new Map(), // id -> base64 pdf
  };
}

// Reuse the existing store on this process; create it only on first use.
const store = globalThis.__ledgerline_results || (globalThis.__ledgerline_results = createStore());

function addRun(record, pdfBase64) {
  store.seq += 1;
  const id = `R-${String(Date.now()).slice(-6)}${String(store.seq).padStart(3, "0")}`;
  const full = {
    id,
    createdAt: new Date().toISOString(),
    pdfUrl: `/api/run-file?id=${id}`,
    extractionSource: record.extractionSource,
    extractionNote: record.extractionNote || null,
    ...record, // status, summary, fileName, extracted, logs, suggestedPO
  };
  store.runs.unshift(full);
  if (pdfBase64) store.files.set(id, pdfBase64);
  return full;
}

function listRuns() {
  return store.runs.map(({ pdfUrl, ...rest }) => rest);
}

function getRun(id) {
  return store.runs.find((r) => r.id === id) || null;
}

function getFile(id) {
  const b64 = store.files.get(id);
  return b64 ? Buffer.from(b64, "base64") : null;
}

function reset() {
  store.runs.length = 0;
  store.files.clear();
  store.seq = 0;
}

module.exports = { addRun, listRuns, getRun, getFile, reset };
