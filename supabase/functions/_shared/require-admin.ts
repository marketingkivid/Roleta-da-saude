// Confere se quem chamou a function é um admin autenticado. Usa o JWT do
// PRÓPRIO chamador (não a service role) para checar a sessão — a chave
// pública sozinha (sempre presente no bundle do site) nunca basta.
import { createClient } from "npm:@supabase/supabase-js@2";

export type AdminCheck = { ok: true; userId: string } | { ok: false; status: number; error: string };

export async function requireAdmin(req: Request): Promise<AdminCheck> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "missing_token" };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false, status: 401, error: "invalid_session" };

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!isAdmin) return { ok: false, status: 403, error: "not_admin" };

  return { ok: true, userId: userData.user.id };
}
