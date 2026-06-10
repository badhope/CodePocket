import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signUpSchema } from "@/lib/validators";
import { checkRateLimit, DEFAULT_ROUTE_LIMITS } from "@/lib/api/ratelimit";
import { withCors, preflight } from "@/lib/api/cors";
import { getClientIp, logger, newRequestId } from "@/lib/api/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Additional password strength rules on top of the zod schema:
//   - not in the top-leaked password list (compact subset embedded below)
//   - contains at least one symbol (improves resistance to dictionary attacks)
const PASSWORD_EXTRA_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
const COMPACT_LEAKED_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "qwertyuiop",
  "letmein",
  "welcome1",
  "iloveyou",
  "admin123",
  "abc12345",
  "p@ssw0rd",
  "passw0rd",
  "sunshine1",
  "princess1",
  "football1",
  "monkey123",
  "shadow123",
  "master123",
  "dragon123",
  "michael123",
  "jennifer1",
  "11111111",
  "trustno1",
  "654321",
  "superman1",
  "qazwsx123",
  "00000000",
  "asdfghjkl",
  "starwars1",
  "computer1",
  "whatever1",
  "blahblah1",
]);

const enhancedSignUpSchema = signUpSchema.refine((d) => PASSWORD_EXTRA_REGEX.test(d.password), {
  message: "Password must contain a symbol",
  path: ["password"],
});

// In-memory low-pass timing-equaliser. We deliberately do *not* try to be
// cryptographically perfect - just enough to raise the cost of a brute-force
// attack on a single account.
const MIN_RESPONSE_DELAY_MS = 250;
const MAX_RESPONSE_DELAY_MS = 600;

async function equaliseDelay(start: number): Promise<void> {
  const elapsed = Date.now() - start;
  const target =
    MIN_RESPONSE_DELAY_MS + Math.floor(Math.random() * (MAX_RESPONSE_DELAY_MS - MIN_RESPONSE_DELAY_MS));
  if (elapsed < target) {
    await new Promise((resolve) => setTimeout(resolve, target - elapsed));
  }
}

function jsonResponse(body: unknown, status: number, origin: string | null): Response {
  // Local helper so we can attach CORS headers in one place. The body is
  // the legacy shape so the existing client (which checks
  // `data.error === "email_taken"`) keeps working.
  const response = new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
  return withCors(response, origin);
}

export async function OPTIONS(req: Request) {
  return preflight(req.headers.get("origin"), {
    allowedMethods: ["POST", "OPTIONS"],
  });
}

export async function POST(req: Request) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const origin = req.headers.get("origin");
  const log = logger.withContext({
    requestId,
    ip,
    path: "/api/auth/sign-up",
    method: "POST",
  });
  const start = Date.now();

  // 1. Rate limit (per-IP + per-route).
  const rl = await checkRateLimit(
    { method: "POST", path: "/api/auth/sign-up", ip },
    { routes: DEFAULT_ROUTE_LIMITS },
  );
  if (!rl.success) {
    log.warn("signup_rate_limited", { scope: rl.scope, retryAfterMs: rl.retryAfterMs });
    await equaliseDelay(start);
    return jsonResponse(
      { error: "rate_limited", retryAfter: Math.ceil(rl.retryAfterMs / 1000) },
      429,
      origin,
    );
  }

  // 2. Parse + validate.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    await equaliseDelay(start);
    log.warn("signup_invalid_json", undefined);
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }

  let parsed: ReturnType<typeof enhancedSignUpSchema.safeParse>;
  try {
    parsed = enhancedSignUpSchema.safeParse(body);
  } catch (err) {
    log.error("signup_parse_threw", undefined, err);
    await equaliseDelay(start);
    return jsonResponse({ error: "internal_error" }, 500, origin);
  }
  if (!parsed.success) {
    log.warn("signup_validation_failed", {
      issues: parsed.error.flatten().fieldErrors,
    });
    await equaliseDelay(start);
    return jsonResponse({ error: "validation", issues: parsed.error.flatten().fieldErrors }, 400, origin);
  }

  const { name, email, password, locale } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  // 3. Extra password quality checks (cheap, runs after the zod schema).
  if (COMPACT_LEAKED_PASSWORDS.has(password.toLowerCase())) {
    log.warn("signup_weak_password", { email: normalizedEmail });
    await equaliseDelay(start);
    return jsonResponse({ error: "weak_password" }, 400, origin);
  }
  const localPart = normalizedEmail.split("@")[0];
  if (localPart && password.toLowerCase().includes(localPart)) {
    log.warn("signup_password_contains_email", { email: normalizedEmail });
    await equaliseDelay(start);
    return jsonResponse({ error: "password_contains_email" }, 400, origin);
  }

  // 4. Uniqueness check.
  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
      columns: { id: true },
    });
    if (existing) {
      log.info("signup_email_taken", { email: normalizedEmail });
      await equaliseDelay(start);
      return jsonResponse({ error: "email_taken" }, 409, origin);
    }
  } catch (err) {
    log.error("signup_db_lookup_failed", { email: normalizedEmail }, err);
    await equaliseDelay(start);
    return jsonResponse({ error: "internal_error" }, 500, origin);
  }

  // 5. Hash + insert.
  let userId: string;
  try {
    userId = nanoid();
    const passwordHash = await bcrypt.hash(password, 12);
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        name,
        email: normalizedEmail,
        passwordHash,
        locale: locale ?? "en",
      });
    });
  } catch (err) {
    log.error("signup_insert_failed", { email: normalizedEmail }, err);
    await equaliseDelay(start);
    return jsonResponse({ error: "internal_error" }, 500, origin);
  }

  log.info("signup_success", {
    userId,
    email: normalizedEmail,
    durationMs: Date.now() - start,
  });
  await equaliseDelay(start);

  return jsonResponse({ id: userId, email: normalizedEmail }, 201, origin);
}
