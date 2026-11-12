/**
 * scripts/make-test-invoices.js — five NEW upload-test invoices.
 *
 * Unlike the bundled samples, these are not referenced anywhere in the app
 * (not in lib/samples.js), so uploading them on the live site exercises the
 * full pipeline: PDF -> LLM extraction -> deterministic engine -> verdict.
 * Each fixture targets a specific rule in lib/validate.js against the mock
 * ERP seed in lib/db.js.
 *
 * Run with:  node scripts/make-test-invoices.js
 * Output:  test-invoices/*.pdf
 */

const path = require("path");
const fs = require("fs");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "test-invoices");
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------
// Minimal PDF writer (same technique as make-samples.js)
// ------------------------------------------------------------------
const INK = [0.06, 0.08, 0.105];
const GRAY = [0.42, 0.46, 0.52];
const LINE = [0.17, 0.21, 0.25];

const WIDTHS = {};
"0123456789".split("").forEach((c) => (WIDTHS[c] = 556));
Object.assign(WIDTHS, { ".": 278, ",": 278, "$": 556, " ": 278, "-": 333, "&": 667, "(": 556, ")": 556, "'": 191, "/": 278, ":": 278, "%": 722 });
function textWidth(str, size) {
  let units = 0;
  for (const ch of str) units += WIDTHS[ch] ?? (ch >= "A" && ch <= "Z" ? 722 : 556);
  return (units / 1000) * size;
}
const esc = (s) => String(s).replace(/([\\()])/g, "\\$1");

function makePage() {
  const ops = [];
  const getBytes = () => {
    const content = ops.join("\n");
    const stream = Buffer.from(content, "latin1");
    const flate = zlib.deflateSync(stream);
    let pdf = "%PDF-1.4\n";
    const obj = (n, body) => {
      pdf += `${n} 0 obj\n${body}\nendobj\n`;
    };
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(
      3,
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>"
    );
    obj(4, `<< /Length ${flate.length} /Filter /FlateDecode >>\nstream\n${flate.toString("latin1")}\nendstream`);
    obj(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    obj(6, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    obj(7, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");
    pdf += "trailer\n<< /Root 1 0 R /Size 8 >>\n%%EOF\n";
    return Buffer.from(pdf, "latin1");
  };
  const text = (font, size, x, y, str, color = INK, align = "left", rightEdge = null) => {
    const s = String(str);
    const px = align === "right" ? rightEdge - textWidth(s, size) : x;
    ops.push(`q ${color.map((c) => c.toFixed(3)).join(" ")} rg BT /${font} ${size} Tf 1 0 0 1 ${px.toFixed(1)} ${y} Tm (${esc(s)}) Tj ET Q`);
  };
  const hline = (x1, x2, y, w = 0.7, color = LINE) =>
    ops.push(`q ${color.map((c) => c.toFixed(3)).join(" ")} RG ${w} w ${x1} ${y} m ${x2} ${y} l S Q`);
  return { text, hline, getBytes };
}

function money(n) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderInvoice(spec) {
  const p = makePage();
  const { text, hline } = p;
  const L = 60;
  const R = 552;
  const T = (top) => 792 - top;

  let top = 52;
  const row = (fn, step = 16) => {
    fn();
    top += step;
  };

  row(() => text("F2", 19, L, T(top), spec.vendor, INK), 20);
  const headTop = top;
  row(() => {
    text("F1", 8.5, L, T(headTop), spec.contact, GRAY);
    text("F2", 15, 0, T(headTop - 4), "INVOICE", INK, "right", R);
  }, 12);
  if (spec.po) {
    row(() => {
      text("F1", 9, 0, T(top), `PO Number: ${spec.po}`, GRAY, "right", R);
      text("F1", 9, 0, T(top + 11), `Order Date: ${spec.poDate || spec.date}`, GRAY, "right", R);
    }, 28);
  } else {
    row(() => {}, 8);
  }
  const ruleTop = top;
  row(() => hline(L, R, T(ruleTop), 0.8), 30);

  row(() => text("F2", 9.5, L, T(top), "BILL TO"), 14);
  ["Ledgerline Industries", "Attn: Accounts Payable", "4400 Industrial Pkwy", "Grand Rapids, MI 49544"].forEach((line) => {
    row(() => text("F1", 9.5, L, T(top), line, [0.22, 0.26, 0.31]), 13);
  });
  const metaRows = [
    ["Invoice Number:", spec.invoice],
    ["Invoice Date:", spec.date],
    ["Due Date:", spec.due],
    ["Payment Terms:", "NET 30"],
    ["Vendor:", spec.vendor],
  ];
  const metaTop = 52 + 20 + 12 + (spec.po ? 28 : 8) + 30;
  metaRows.forEach(([k, v], i) => {
    text("F1", 9, 400, T(metaTop + 14 + i * 14), k, [0.22, 0.26, 0.31]);
    text("F1", 9, 480, T(metaTop + 14 + i * 14), v, INK);
  });

  const tableTop = metaTop + 14 + metaRows.length * 14 + 34;
  text("F2", 9, L, T(tableTop), "DESCRIPTION", GRAY);
  text("F2", 9, 0, T(tableTop), "QTY", GRAY, "right", 370);
  text("F2", 9, 0, T(tableTop), "UNIT PRICE", GRAY, "right", 460);
  text("F2", 9, 0, T(tableTop), "AMOUNT", GRAY, "right", R);
  hline(L, R, T(tableTop + 4), 0.7);
  let y = tableTop + 18;
  spec.lines.forEach(([desc, qty, price, amt]) => {
    text("F1", 10, L, T(y), desc, [0.1, 0.13, 0.17]);
    text("F1", 10, 0, T(y), String(qty), [0.1, 0.13, 0.17], "right", 370);
    text("F1", 10, 0, T(y), money(price), [0.1, 0.13, 0.17], "right", 460);
    text("F1", 10, 0, T(y), money(amt), [0.1, 0.13, 0.17], "right", R);
    y += 15;
  });
  y += 2;
  hline(L, R, T(y), 0.5);
  y += 16;
  text("F1", 10, 0, T(y), "Subtotal", [0.22, 0.26, 0.31], "right", 450);
  text("F1", 10, 0, T(y), money(spec.subtotal), [0.1, 0.13, 0.17], "right", R);
  y += 15;
  text("F1", 10, 0, T(y), spec.taxLabel, [0.22, 0.26, 0.31], "right", 450);
  text("F1", 10, 0, T(y), money(spec.tax), [0.1, 0.13, 0.17], "right", R);
  y += 16;
  text("F2", 12, 0, T(y), "Total Due", INK, "right", 450);
  text("F2", 12, 0, T(y), money(spec.total), INK, "right", R);
  hline(440, R, T(y + 5), 1.1, INK);
  y += 14;
  text("F1", 8.5, 0, T(y), `Amount Due (USD): ${money(spec.total)}`, GRAY, "right", R);
  text("F3", 8.5, L, T(742), "Thank you for your business. Payment terms: NET 30 from invoice date.", GRAY);
  return p.getBytes();
}

// ------------------------------------------------------------------
// Five fixtures, each targeting a specific engine rule (lib/validate.js)
// against the seeded mock ERP (lib/db.js). All invoice numbers are new,
// so none collide with the seeded duplicate ledger.
// ------------------------------------------------------------------
const testInvoices = [
  {
    // T1 · happy path on a fresh PO -> APPROVED, PO-2024-0901 balance -> $0
    file: "test-01-vertex-tooling.pdf",
    vendor: "Vertex Manufacturing Inc.",
    contact: "1400 Industrial Pkwy, Toledo, OH 43604 · +1 (419) 555-0167 · Tax ID: 45-2211889",
    invoice: "INV-2026-0311",
    po: "PO-2024-0901",
    date: "2026-10-02",
    poDate: "2024-06-15",
    due: "2026-11-01",
    lines: [
      ["CNC spindle assembly, 24 kW", 2, 5200, 10400],
      ["Precision tooling set, batch 12", 1, 3480, 3480],
      ["Calibration & alignment service", 1, 1900, 1900],
    ],
    subtotal: 15780,
    tax: 0,
    taxLabel: "Tax (0%)",
    total: 15780,
  },
  {
    // T2 · embedded 18% tax: total = 3875.50 + 697.59 = 4573.09 -> APPROVED (tax tolerance)
    file: "test-02-helios-tax18.pdf",
    vendor: "Helios Office Solutions",
    contact: "77 Main St, Columbus, OH 43215 · +1 (614) 555-0133 · Tax ID: 84-9900112",
    invoice: "INV-2026-0322",
    po: "PO-2024-0512",
    date: "2026-10-11",
    poDate: "2024-04-20",
    due: "2026-11-10",
    lines: [
      ["Ergonomic task chairs (case)", 6, 214.9, 1289.4],
      ["Standing desk, electric height", 1, 420, 420],
      ["Delivery & install", 1, 435.8, 435.8],
      ["VAT (18%) on order", 1, 697.59, 697.59],
    ],
    subtotal: 2145.2,
    tax: 697.59,
    taxLabel: "Tax (18%)",
    total: 4573.09,
  },
  {
    // T3 · invoice exceeds the PO by $500 — not an 8%/18% tax -> PENDING_REVIEW
    file: "test-03-metro-overcharge.pdf",
    vendor: "Metro Facilities Corp",
    contact: "300 Commerce Center, Detroit, MI 48201 · +1 (313) 555-0121 · Tax ID: 38-6677554",
    invoice: "INV-2026-0330",
    po: "PO-1402",
    date: "2026-10-19",
    poDate: "2026-09-30",
    due: "2026-11-18",
    lines: [
      ["Quarterly maintenance retainer", 1, 3600, 3600],
      ["Emergency call-out, Oct 8", 1, 900, 900],
    ],
    subtotal: 4500,
    tax: 0,
    taxLabel: "Tax (0%)",
    total: 4500,
  },
  {
    // T4 · invoice cites a PO that belongs to a different vendor -> PENDING_REVIEW (PO/vendor mismatch)
    file: "test-04-aurora-wrong-po.pdf",
    vendor: "Aurora Legal LLP",
    contact: "Suite 900, 1 Liberty Sq, Chicago, IL 60601 · +1 (312) 555-0177 · Tax ID: 72-5566778",
    invoice: "INV-2026-0344",
    po: "PO-2024-0417",
    date: "2026-10-25",
    poDate: "2026-10-01",
    due: "2026-11-24",
    lines: [
      ["Legal consultation, partner level (40 hrs)", 40, 120, 4800],
      ["Filing fees & disbursements", 1, 1600, 1600],
    ],
    subtotal: 6400,
    tax: 0,
    taxLabel: "Tax (0%)",
    total: 6400,
  },
  {
    // T5 · cites a PO number that does not exist in the ERP -> PENDING_REVIEW (unknown PO)
    file: "test-05-vertex-unknown-po.pdf",
    vendor: "Vertex Manufacturing Inc.",
    contact: "1400 Industrial Pkwy, Toledo, OH 43604 · +1 (419) 555-0167 · Tax ID: 45-2211889",
    invoice: "INV-2026-0358",
    po: "PO-9999-0420",
    date: "2026-11-02",
    poDate: "2026-10-15",
    due: "2026-12-02",
    lines: [
      ["Tooling replacement, units 4-6", 3, 2050, 6150],
      ["Assembly & quality check", 1, 1050, 1050],
    ],
    subtotal: 7200,
    tax: 0,
    taxLabel: "Tax (0%)",
    total: 7200,
  },
];

for (const spec of testInvoices) {
  fs.writeFileSync(path.join(OUT, spec.file), renderInvoice(spec));
  console.log("wrote test-invoices/" + spec.file);
}
console.log("All test invoices generated.");
