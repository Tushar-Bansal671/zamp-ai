/** Shared formatting helpers for UI + API responses. */

const STATUS_META = {
  APPROVED: { label: "Approved", badge: "ok" },
  PENDING_REVIEW: { label: "Pending review", badge: "warn" },
  REJECTED: { label: "Rejected", badge: "bad" },
  MANUAL_ENTRY_REQUIRED: { label: "Manual entry", badge: "manual" },
};

function statusMeta(status) {
  return STATUS_META[status] || { label: status, badge: "manual" };
}

function money(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function timestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

module.exports = { statusMeta, money, shortDate, timestamp, STATUS_META };
