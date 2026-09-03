import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "Marketing@kivid.com.br";
  const password = "#DigitalKivid2025";

  const { data: existing } = await supabase.auth.admin.listUsers();
  let user = existing.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    user = data.user!;
  } else {
    await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  }

  const { error: roleErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role" });

  if (roleErr) return new Response(JSON.stringify({ error: roleErr.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true, user_id: user.id }), {
    headers: { "content-type": "application/json" },
  });
});
