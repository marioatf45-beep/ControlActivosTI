export function publishableKey(): string | undefined {
  return Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
}

export function secretKey(): string | undefined {
  return Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}
