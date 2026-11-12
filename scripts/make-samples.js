/**
 * scripts/make-samples.js — generates the demo invoice PDFs in public/samples.
 *
 * Dependency-free (Node stdlib + zlib): writes a real multi-font PDF
 * (Helvetica / Bold / Oblique) in the standard letterhead-invoice layout:
 * vendor letterhead, Bill-To block, key/value metadata, a line-item table,
 * Subtotal/Tax/Total Due, and a footer. Each fixture triggers one engine
 * rule; the last one is an "external" invoice for testing uploads.
 *
 * Run with:  node scripts/make-samples.js
 */

const path = require("path");
const fs = require("fs");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "public", "samples");
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------
// Minimal PDF writer (one page, three built-in fonts, vector lines)
// ------------------------------------------------------------------
const INK = [0.06, 0.08, 0.105]; // #10151a
const GRAY = [0.42, 0.46, 0.52]; // #6b7684-ish
const LINE = [0.17, 0.21, 0.25]; // #2b3541

// Approximate Helvetica advance widths (1/1000 em), good enough for right-align.
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
  const textRight = (font, size, rightEdge, y, str, color = INK) => text(font, size, 0, y, str, color, "right", rightEdge);
  const hline = (x1, x2, y, w = 0.7, color = LINE) =>
    ops.push(`q ${color.map((c) => c.toFixed(3)).join(" ")} RG ${w} w ${x1} ${y} m ${x2} ${y} l S Q`);

  return { text, textRight, hline, getBytes };
}

// ------------------------------------------------------------------
function money(n) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Fixture layout — one function that renders a full invoice page
// ------------------------------------------------------------------
function renderInvoice(spec) {
  const p = makePage();
  const { text, textRight, hline } = p;
  const L = 60;
  const R = 552;
  const T = (top) => 792 - top; // PDF y is measured from the bottom

  let top = 52;
  const row = (fn, step = 16) => {
    fn();
    top += step;
  };

  // Letterhead + INVOICE title (right)
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

  // Bill-To block (left) + key/value metadata (right)
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
  const metaStart = T(752 - 460 + 0); // compute right-side start from left side's start
  const metaTop = 52 + 20 + 12 + (spec.po ? 28 : 8) + 30; // where BILL TO started
  metaRows.forEach(([k, v], i) => {
    text("F1", 9, 400, T(metaTop + 14 + i * 14), k, [0.22, 0.26, 0.31]);
    text("F1", 9, 480, T(metaTop + 14 + i * 14), v, INK);
  });

  // Line-item table
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

  // Footer
  text("F3", 8.5, L, T(742), "Thank you for your business. Payment terms: NET 30 from invoice date.", GRAY);
  return p.getBytes();
}

// ------------------------------------------------------------------
// Fixtures — one per engine rule
// ------------------------------------------------------------------
const invoices = [
  {
    // 01 · happy path: approved vendor, exact PO + amount match -> APPROVED
    file: "sample-01-happy.pdf",
    vendor: "Nimbus Tech Supply Co.",
    contact: "2200 Commerce Blvd, Dayton, OH 45402 · +1 (937) 555-0142 · Tax ID: 98-7654321",
    invoice: "INV-2024-0142",
    po: "PO-2024-0417",
    date: "2024-04-16",
    poDate: "2024-04-01",
    due: "2024-05-16",
    lines: [
      ["Steel brackets, 12-gauge (part #A-118)", 2, 4150, 8300],
      ["Rack install & cabling, on-site", 1, 2400, 2400],
      ["Anti-vibration mounts, medium", 1, 1750, 1750],
    ],
    subtotal: 12450,
    tax: 0,
    taxLabel: "Tax (0%)",
    total: 12450,
  },
  {
    // 02 · embedded 8% tax: total = PO total + exactly 8% -> APPROVED (tax tolerance)
    file: "sample-02-tax.pdf",
    vendor: "Nimbus Tech Supply Co.",
    contact: "2200 Commerce Blvd, Dayton, OH 45402 · +1 (937) 555-0142 · Tax ID: 98-7654321",
    invoice: "INV-2024-0155",
    po: "PO-2024-0417",
    date: "2024-05-02",
    poDate: "2024-04-01",
    due: "2024-06-01",
    lines: [
      ["Steel brackets, 12-gauge (part #A-118)", 2, 4150, 8300],
      ["Rack install & cabling, on-site", 1, 2400, 2400],
      ["Anti-vibration mounts, medium", 1, 1750, 1750],
    ],
    subtotal: 12450,
    tax: 996,
    taxLabel: "Tax (8%)",
    total: 13446,
  },
  {
    // 03 · duplicate: invoice number already in the processed ledger -> REJECTED
    file: "sample-03-duplicate.pdf",
    vendor: "Northbridge Logistics Ltd.",
    contact: "88 Harbor Drive, Cleveland, OH 44114 · +1 (216) 555-0188 · Tax ID: 31-4455667",
    invoice: "INV-2024-0031",
    po: "PO-2024-0788",
    date: "2024-08-01",
    poDate: "2024-07-10",
    due: "2024-08-31",
    lines: [
      ["Freight - inter-site equipment move", 1, 780, 780],
      ["Expedite surcharge", 1, 60, 60],
    ],
    subtotal: 840,
    tax: 0,
    taxLabel: "Tax (0%)",
    total: 840,
  },
  {
    // 04 · unapproved vendor -> REJECTED (compliance)
    file: "sample-04-unapproved-vendor.pdf",
    vendor: "Cascade Facilities Inc.",
    contact: "410 Lakeside Ave, Tacoma, WA 98402 · +1 (253) 555-0114 · Tax ID: 57-8899001",
    invoice: "INV-2024-0158",
    po: "PO-2024-0902",
    date: "2024-04-27",
    poDate: "2024-04-05",
    due: "2024-05-27",
    lines: [
      ["HVAC filter service, HQ floors 1-3", 3, 1980, 5940],
      ["Forklift lease transfer & commissioning", 1, 3860, 3860],
      ["Site inspection & compliance audit", 1, 1200, 1200],
    ],
    subtotal: 11000,
    tax: 0,
    taxLabel: "Tax (0%)",
    total: 11000,
  },
  {
    // 05 · no PO reference printed -> engine infers the unique PO -> PENDING_REVIEW
    file: "sample-05-missing-po.pdf",
    vendor: "Aurora Legal LLP",
    contact: "Suite 900, 1 Liberty Sq, Chicago, IL 60601 · +1 (312) 555-0177 · Tax ID: 72-5566778",
    invoice: "INV-2024-0168",
    po: null,
    date: "2024-05-20",
    due: "2024-06-19",
    lines: [
      ["Contract review - procurement framework", 1, 8200, 8200],
      ["Counsel time, partner level (42.5 hrs)", 42.5, 250, 10625],
      ["Regulatory filings & registry fees", 1, 3175, 3175],
    ],
    subtotal: 22000,
    tax: 0,
    taxLabel: "Tax (0%)",
    total: 22000,
  },
  {
    // 06 · PO already closed -> REJECTED
    file: "sample-06-closed-po.pdf",
    vendor: "Northbridge Logistics Ltd.",
    contact: "88 Harbor Drive, Cleveland, OH 44114 · +1 (216) 555-0188 · Tax ID: 31-4455667",
    invoice: "INV-2024-0170",
    po: "PO-2024-0788",
    date: "2024-06-11",
    poDate: "2024-07-10",
    due: "2024-07-11",
    lines: [
      ["Freight - inter-site equipment move", 1, 780, 780],
      ["Expedite surcharge", 1, 60, 60],
    ],
    subtotal: 840,
    tax: 0,
    taxLabel: "Tax (0%)",
    total: 840,
  },
  {
    // 07 · EXTERNAL-style invoice: approved vendor, brand-new amount, PO not in the
    //      ERP -> exercises the "unknown PO, no unique match" path -> PENDING_REVIEW.
    //      Use this to test uploading your own PDFs with foreign data.
    file: "external-demo-invoice.pdf",
    vendor: "Helios Office Solutions",
    contact: "77 Main St, Columbus, OH 43215 · +1 (614) 555-0133 · Tax ID: 84-9900112",
    invoice: "INV-EXT-2026-007",
    po: "PO-2024-7777",
    date: "2026-11-05",
    poDate: "2026-10-20",
    due: "2026-12-05",
    lines: [
      ["Ergonomic task chairs (case)", 6, 214.9, 1289.4],
      ["Standing desk, electric height", 1, 420, 420],
      ["Delivery & install", 1, 435.8, 435.8],
    ],
    subtotal: 2145.2,
    tax: 0,
    taxLabel: "Tax (0%)",
    total: 2145.2,
  },
];

for (const spec of invoices) {
  fs.writeFileSync(path.join(OUT, spec.file), renderInvoice(spec));
  console.log("wrote public/samples/" + spec.file);
}
console.log("All sample invoices generated.");
