import { NextResponse } from "next/server";
import { getFile } from "@/lib/results";

export const dynamic = "force-dynamic";

/** Serves the stored PDF bytes for a processed run (used by the audit iframe). */
export function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const buf = getFile(id);
  if (!buf) return new Response("File not found", { status: 404 });
  return new Response(buf, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "no-store",
    },
  });
}
