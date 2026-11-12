import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    purchaseOrders: db.purchaseOrders,
    approvedVendors: db.approvedVendors,
    ledgerSize: db.duplicateLedger.length,
  });
}
