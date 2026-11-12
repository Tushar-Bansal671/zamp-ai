/** The bundled demo invoices (public/samples/*.pdf) and what each one should trigger. */

export const SAMPLES = [
  {
    file: "sample-01-happy.pdf",
    short: "s1",
    vendor: "Nimbus Tech Supply Co.",
    invoice: "INV-2024-0142",
    label: "Clean invoice — exact PO match",
    expect: "Approved",
  },
  {
    file: "sample-02-tax.pdf",
    short: "s2",
    vendor: "Nimbus Tech Supply Co.",
    invoice: "INV-2024-0155",
    label: "Invoice embeds 8% tax — variance tolerance",
    expect: "Approved (tax tolerance)",
  },
  {
    file: "sample-03-duplicate.pdf",
    short: "s3",
    vendor: "Northbridge Logistics Ltd.",
    invoice: "INV-2024-0031",
    label: "Invoice already in the duplicate ledger",
    expect: "Rejected (duplicate)",
  },
  {
    file: "sample-04-unapproved-vendor.pdf",
    short: "s4",
    vendor: "Cascade Facilities Inc.",
    invoice: "INV-2024-0158",
    label: "Vendor missing from the approved master list",
    expect: "Rejected (compliance)",
  },
  {
    file: "sample-05-missing-po.pdf",
    short: "s5",
    vendor: "Aurora Legal LLP",
    invoice: "INV-2024-0168",
    label: "No PO reference printed — engine must infer it",
    expect: "Pending review (PO inferred)",
  },
  {
    file: "sample-06-closed-po.pdf",
    short: "s6",
    vendor: "Northbridge Logistics Ltd.",
    invoice: "INV-2024-0170",
    label: "PO already closed, exact amount",
    expect: "Rejected (closed PO)",
  },
  {
    file: "external-demo-invoice.pdf",
    short: "s7",
    vendor: "Helios Office Solutions",
    invoice: "INV-EXT-2026-007",
    label: "External invoice (new vendor+PO) — upload-test",
    expect: "Approved",
  },
];

export function sampleUrl(f) {
  return `/samples/${f}`;
}
