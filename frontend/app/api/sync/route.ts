import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

// Root of the monorepo — one level above the Next.js app
const PROJECT_ROOT = path.resolve(process.cwd(), "..");

async function runPython(module: string): Promise<void> {
  const { stdout, stderr } = await execFileAsync("python", ["-m", module], {
    cwd: PROJECT_ROOT,
  });
  if (stdout) console.log(`[sync] ${module} stdout:`, stdout.trim());
  if (stderr) console.warn(`[sync] ${module} stderr:`, stderr.trim());
}

export async function POST(): Promise<NextResponse> {
  console.log("[sync] Starting sync — data.ingest then scoring.save_risk");

  try {
    await runPython("data.ingest");
    console.log("[sync] data.ingest complete");

    await runPython("scoring.save_risk");
    console.log("[sync] scoring.save_risk complete");

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync] Sync failed:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
