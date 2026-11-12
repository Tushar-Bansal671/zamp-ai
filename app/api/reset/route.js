import { NextResponse } from "next/server";
import { resetStore } from "@/lib/db";
import { reset as resetRuns } from "@/lib/results";

export const dynamic = "force-dynamic";

/** Wipes session state: run history, duplicate ledger, and PO balances. */
export function POST() {
  resetStore();
  resetRuns();
  return NextResponse.json({ ok: true });
}
