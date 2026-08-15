import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, readJson } from "../_shared/http.ts";
import { publishableKey, secretKey } from "../_shared/supabase-keys.ts";

const ROLES = new Set(["Administrador", "Tecnico", "Inventario", "SoloLectura", "ServiceDesk"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,72}$/;
function assuranceLevel(token: string): string {
  try {
    const value = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = value.padEnd(Math.ceil(value.length / 4) * 4, "=");
    return JSON.parse(atob(padded))?.aal || "aal1";
  } catch { return "aal1"; }
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (!cors) return jsonResponse({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405, cors);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = publishableKey();
  const serviceRoleKey = secretKey();
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: "SERVICE_UNAVAILABLE" }, 503, cors);
  if (!token) return jsonResponse({ error: "UNAUTHORIZED" }, 401, cors);

  const verifier = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: callerData, error: callerError } = await verifier.auth.getUser(token);
  if (callerError || !callerData.user) return jsonResponse({ error: "UNAUTHORIZED" }, 401, cors);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller } = await admin.from("profiles").select("id, role, active").eq("id", callerData.user.id).maybeSingle();
  if (!caller?.active || caller.role !== "Administrador") return jsonResponse({ error: "FORBIDDEN" }, 403, cors);
  if (assuranceLevel(token) !== "aal2") return jsonResponse({ error: "MFA_REQUIRED" }, 403, cors);

  const body = await readJson(request);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const login = typeof body?.login === "string" ? body.login.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  const active = body?.active;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!UUID.test(userId) || !fullName || fullName.length > 160 || !/^[a-z0-9._-]{3,64}$/.test(login) || !ROLES.has(role) || typeof active !== "boolean") {
    return jsonResponse({ error: "INVALID_INPUT", message: "Los datos del usuario no son válidos." }, 400, cors);
  }
  if (password && !PASSWORD.test(password)) return jsonResponse({ error: "INVALID_PASSWORD", message: "La contraseña no cumple la política de seguridad." }, 400, cors);
  if (userId === caller.id && (!active || role !== "Administrador")) {
    return jsonResponse({ error: "SELF_LOCKOUT", message: "No puedes desactivar ni quitar el rol administrador a tu propia cuenta." }, 409, cors);
  }

  const { data: target, error: targetError } = await admin.from("profiles").select("id, login, role, active").eq("id", userId).maybeSingle();
  if (targetError || !target) return jsonResponse({ error: "USER_NOT_FOUND" }, 404, cors);
  if (target.active && target.role === "Administrador" && (!active || role !== "Administrador")) {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "Administrador").eq("active", true);
    if ((count || 0) <= 1) return jsonResponse({ error: "LAST_ADMIN", message: "Debe permanecer al menos un administrador activo." }, 409, cors);
  }
  const { data: duplicate } = await admin.from("profiles").select("id").eq("login", login).neq("id", userId).maybeSingle();
  if (duplicate) return jsonResponse({ error: "LOGIN_IN_USE", message: "Ese nombre de usuario ya está en uso." }, 409, cors);

  const authChanges: Record<string, unknown> = { ban_duration: active ? "none" : "876000h" };
  if (password) authChanges.password = password;
  const { error: authError } = await admin.auth.admin.updateUserById(userId, authChanges);
  if (authError) {
    console.error("admin-manage-user auth:", authError.message);
    return jsonResponse({ error: "AUTH_UPDATE_FAILED", message: "No se pudo actualizar la cuenta de acceso." }, 502, cors);
  }

  const changes: Record<string, unknown> = { full_name: fullName, login, role, active };
  if (password) changes.password_changed_at = new Date().toISOString();
  const { error: profileError } = await admin.from("profiles").update(changes).eq("id", userId);
  if (profileError) {
    console.error("admin-manage-user profile:", profileError.message);
    return jsonResponse({ error: "PROFILE_UPDATE_FAILED", message: "La cuenta cambió, pero el perfil no pudo sincronizarse. Revisa los registros." }, 500, cors);
  }

  return jsonResponse({ success: true }, 200, cors);
});
