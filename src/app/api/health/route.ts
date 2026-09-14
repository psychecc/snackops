import { NextResponse } from "next/server";
import { getDataDir } from "@/lib/store";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "SnackOps",
    dataDir: getDataDir(),
    checkedAt: new Date().toISOString(),
  });
}
