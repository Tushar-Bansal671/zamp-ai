# Ledgerline — Demo Video Script

A three-minute demo that a judge can follow end-to-end: open app → run an
invoice → watch the terminal → inspect the audit trail → run the hard cases.
Every action is deliberate, every screen is explained out loud. Total ≈ 3:00–3:30.

---

## Scene 0 — Cold open (0:00–0:20)

**On screen:** Dashboard, fresh state (clean stats, empty queue, PO table visible).

> "Every month, finance teams drown in vendor invoices. Someone has to open
> each PDF, read the numbers, hunt for the matching purchase order, and
> double-check the totals — then a human signs off. **Ledgerline** does that
> work end-to-end: it reads the invoice, checks it against our purchase orders,
> and makes a defensible approve-or-hold decision — with a full audit trail a
> human can inspect. No invoice touches the general ledger until it survives
> this pipeline. Here's the dashboard: every invoice we've processed, what we
> decided, and the purchase orders we're checking against."

*(Optional: press **Reset session** so the judges see a clean run, and the PO
table refill.)*

---

## Scene 1 — Happy path (0:20–1:10)

**On screen:** `/process` → "Show a sample invoice" → pick **"Clean invoice —
exact PO match"** → *Load this invoice* → **Run engine**.

> "Let's process one. I'm not hand-typing any data — I'm loading the invoice
> PDF itself. Watch the execution terminal: the engine ingests the file, sends
> the PDF to the language model, and gets back strict structured JSON — vendor,
> invoice number, date, total, tax, PO reference. Then the *deterministic*
> engine — not the AI — does the judgment: it checks the duplicate ledger,
> verifies the vendor is on the approved master list, resolves the purchase
> order, confirms the amounts line up. **Approved.** And notice what just
> happened in the background: PO-2024-0417's remaining balance was decremented,
> and this invoice was written to the duplicate ledger. Go back to the
> dashboard — you can see it there."

*(Cut: dashboard PO table — the balance column has changed.)*

> "That's the key design: the LLM only *reads*. No dollar-sign decision is
> ever left to the model. A rule engine owns the verdict, and every rule it
> applies is logged."

---

## Scene 2 — The audit view (1:10–1:45)

**On screen:** Verdict card → **Open side-by-side audit** → `/audit/[id]`.

> "Now the part auditors care about: *why* did it approve? The audit view puts
> the original PDF and the machine's reasoning side by side. Left, the exact
> document that was processed — byte-identical. Right, what we read out of it,
> in plain language, then the step-by-step rule log: ledger clear, vendor
> approved, PO matched, amounts within tolerance. No black box. If a CFO asks
> 'why did this go through?', this is the answer."

---

## Scene 3 — The hard cases (1:45–2:45)

Run three samples in a row, ~15 seconds each; let the terminal animate:

1. **Duplicate** → "What if this invoice is submitted twice? The engine
   catches it in the ledger and halts payment: *'Duplicate invoice detected.
   Payment halted.'* No double pay."
2. **Missing PO** → "Now an invoice arrives with no PO reference. The engine
   infers it: a unique purchase order matching vendor plus amount — it holds
   the invoice for a human to confirm, *'Suggested PO match found.'* It never
   guesses on money."
3. **8% tax tolerance** → "Total exceeds the PO? The engine checks the
   variance against recognized tax rates. Eight percent — that's tax. Approved
   within tolerance. The rules handle the boring edge cases so people don't
   have to."

*(Optional 10s: the unapproved-vendor sample → "Vendor isn't on the master
list? Rejected for compliance. That's the fraud gate.")*

---

## Scene 4 — Bring your own invoice (2:45–3:10)

**On screen:** Drag **`external-demo-invoice.pdf`** (or any real invoice) into
the drop zone → Run.

> "None of that was hard-coded to these samples. Drop in *any* invoice PDF —
> real vendor, real numbers — and the same pipeline runs. This one matches a
> different PO in the system: extracted, validated, approved. And if a
> document is too messy to read automatically, the engine says so explicitly
> and flags it for manual entry, instead of silently guessing."

---

## Scene 5 — Close (3:10–3:30)

**On screen:** Dashboard, full history visible.

> "So the system is: an LLM that reads, a rule engine that decides, and an
> audit trail that proves it. Extraction is fast — a few seconds per invoice —
> and the verdicts are deterministic, so the same invoice always gets the same
> answer. It's built to be dropped in front of a real accounts-payable stack:
> the mock ERP is already isolated behind one module, so swapping in a real
> database is a one-file change. Questions?"

---

## Production notes for the live demo

- **Use `npm run build && npm start`** (not `dev`) during the demo. All state
  lives on the server process, so dev hot-reloads can reset the queue
  mid-presentation.
- Set `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL=claude-3-5-haiku-20241022` in
  `.env.local` so Scene 1's terminal shows the LLM extraction path, and so
  a scanned/real PDF can be read too.
- Sequence the hard cases **before** re-running the happy path: re-running the
  approved invoice after the fact is itself a great moment — *"Watch: I just
  approved that invoice, so the moment I submit it again…"* → **REJECTED,
  duplicate.** Save it for the last 20 seconds; it lands well.
- Record at 1080p, keep the browser tab full-window so the terminal text is
  legible; pause ~1 s on each verdict before cutting.
