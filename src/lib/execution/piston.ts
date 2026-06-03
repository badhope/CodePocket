// @ts-nocheck
import type {
  ExecuteRequest,
  ExecuteResponse,
  PistonResult,
  PistonRuntime,
  ExecuteLimits,
  PistonStage,
} from "./protocol";
import { DEFAULT_LIMITS } from "./protocol";

const PISTON_URL = process.env.PISTON_API_URL ?? "https://emkc.org/api/v2/piston";
const PISTON_KEY = process.env.PISTON_API_KEY ?? "";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (PISTON_KEY) h["authorization"] = `Bearer ${PISTON_KEY}`;
  return h;
}

export async function listRuntimes(): Promise<PistonRuntime[]> {
  try {
    const r = await fetch(`${PISTON_URL}/runtimes`, { headers: headers(), next: { revalidate: 3600 } });
    if (!r.ok) throw new Error(`Piston runtimes: ${r.status}`);
    return (await r.json()) as PistonRuntime[];
  } catch (e) {
    console.error("Failed to fetch Piston runtimes:", e);
    return [];
  }
}

export async function executeCode(
  req: ExecuteRequest,
  limits: ExecuteLimits = DEFAULT_LIMITS,
): Promise<ExecuteResponse> {
  const body = JSON.stringify({
    language: req.language,
    version: req.version,
    files: req.files,
    stdin: req.stdin ?? "",
    args: req.args ?? [],
    compile_timeout: req.compile_timeout ?? limits.cpuTimeMs,
    run_timeout: req.run_timeout ?? limits.cpuTimeMs,
    compile_memory_limit: limits.memoryMB * 1024 * 1024,
    run_memory_limit: limits.memoryMB * 1024 * 1024,
    env: req.env ?? [],
  });

  try {
    const r = await fetch(`${PISTON_URL}/execute`, {
      method: "POST",
      headers: headers(),
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(limits.wallTimeMs + 5_000),
    });
    if (!r.ok) {
      const text = await r.text();
      return { success: false, error: `Piston ${r.status}`, message: text };
    }
    const result = (await r.json()) as PistonResult;
    return { success: true, result };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: "execution_failed", message: msg };
  }
}

export function isStageError(stage: PistonStage | undefined): boolean {
  if (!stage) return false;
  return stage.code !== 0 || !!stage.signal;
}
