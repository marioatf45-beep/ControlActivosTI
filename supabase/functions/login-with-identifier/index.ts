import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import { publishableKey, secretKey } from "../_shared/supabase-keys.ts";

const GENERIC_ERROR = { error: "INVALID_CREDENTIALS", message: "Usuario, correo o contraseña incorrectos." };
const DUMMY_EMAIL = "invalid-login@invalid.controlti.local";
const credentialsError = (cors: HeadersInit) => jsonResponse(GENERIC_ERROR, 401, cors);

async function hashKey(kind: string, value: string, secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${secret}:${kind}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `${kind}:` + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function clientAddress(request: Request): string {
  return request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (!cors) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = publishableKey();
  const serviceRoleKey = secretKey();
  const rateLimitSecret = Deno.env.get("CONTROLTI_RATE_LIMIT_SECRET");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !rateLimitSecret) {
    console.error("login-with-identifier: missing required environment variables");
    return jsonResponse({ error: "SERVICE_UNAVAILABLE" }, 503, cors);
  }

  const body = await readJson(request);
  const identifier = typeof body?.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!identifier || identifier.length > 254 || !password || password.length > 256) return credentialsError(cors);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ipKey = await hashKey("ip", clientAddress(request), rateLimitSecret);
  const idKey = await hashKey("identifier", identifier, rateLimitSecret);
  const { data: ipAllowed, error: ipRateError } = await admin.rpc("controlti_check_login_rate", {
    p_keys: [ipKey], p_limit: 30, p_window_seconds: 900,
  });
  const { data: identifierAllowed, error: identifierRateError } = await admin.rpc("controlti_check_login_rate", {
    p_keys: [idKey], p_limit: 8, p_window_seconds: 900,
  });
  if (ipRateError || identifierRateError) {
    console.error("login-with-identifier rate limit:", ipRateError?.message || identifierRateError?.message);
    return jsonResponse({ error: "SERVICE_UNAVAILABLE" }, 503, cors);
  }
  if (ipAllowed !== true || identifierAllowed !== true) {
    return jsonResponse({ error: "TOO_MANY_ATTEMPTS", message: "Demasiados intentos. Espera 15 minutos." }, 429, cors);
  }

  let email = identifier.includes("@") ? identifier : DUMMY_EMAIL;
  if (!identifier.includes("@")) {
    const { data } = await admin.from("profiles").select("email").eq("login", identifier).eq("active", true).maybeSingle();
    if (data?.email) email = data.email;
  }

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) return credentialsError(cors);

  const { data: profile } = await admin.from("profiles").select("active").eq("id", data.user.id).maybeSingle();
  if (!profile?.active) return credentialsError(cors);
  await admin.from("controlti_login_attempts").delete().in("key", [ipKey, idKey]);

  return jsonResponse({
    success: true,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      expires_at: data.session.expires_at,
      token_type: data.session.token_type,
    },
  }, 200, cors);
});
