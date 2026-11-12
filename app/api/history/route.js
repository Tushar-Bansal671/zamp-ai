import { NextResponse } from "next/server";
import { listRuns } from "@/lib/results";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ runs: listRuns() });
}
