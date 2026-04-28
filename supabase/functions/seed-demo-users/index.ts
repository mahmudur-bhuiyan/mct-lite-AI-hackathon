// Seeds the 3 demo accounts and assigns roles. Idempotent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DemoUser {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "moderator" | "user" | "loan_officer";
}

const DEMO_USERS: DemoUser[] = [
  { email: "admin@demo.co", password: "DemoAdmin!2026", full_name: "Demo Admin", role: "admin" },
  { email: "lo@demo.co",    password: "DemoLO!2026",    full_name: "Demo Loan Officer", role: "loan_officer" },
  { email: "user@demo.co",  password: "DemoU!2026",     full_name: "Demo User", role: "user" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: any[] = [];

  for (const u of DEMO_USERS) {
    try {
      // Find existing
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list?.users.find((x) => x.email?.toLowerCase() === u.email);

      let userId: string;
      if (existing) {
        userId = existing.id;
        await admin.auth.admin.updateUserById(userId, {
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
      } else {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
        if (cErr) throw cErr;
        userId = created.user!.id;
      }

      // Upsert profile
      await admin.from("profiles").upsert(
        { id: userId, email: u.email, full_name: u.full_name },
        { onConflict: "id" },
      );

      // Reset roles, then insert correct role
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role: u.role });

      results.push({ email: u.email, userId, role: u.role, ok: true });
    } catch (err) {
      results.push({ email: u.email, ok: false, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
