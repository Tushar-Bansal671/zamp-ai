import { NextResponse } from "next/server";
import { getRun } from "@/lib/results";

export const dynamic = "force-dynamic";

export function GET(req, { params }) {
  const run = getRun(params.id);
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  return NextResponse.json({ run });
}
