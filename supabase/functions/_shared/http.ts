const DEFAULT_ORIGINS = [
  "https://marioatf45-beep.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("CONTROLTI_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ORIGINS);
}

export function corsHeaders(request: Request): HeadersInit | null {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) return null;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

export function jsonResponse(body: unknown, status = 200, cors: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}
