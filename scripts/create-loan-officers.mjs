/**
 * One-off: create loan officer accounts via Supabase Admin API.
 * Run: node scripts/create-loan-officers.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://owggpxshwmfnyrrzosul.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const users = [
  { email: "cristiano.ronaldo@gmail.com", full_name: "Cristiano Ronaldo", password: "User@123" },
  { email: "neymar.jr@gmail.com", full_name: "Neymar Jr", password: "User@123" },
  { email: "kylian.mbappe@gmail.com", full_name: "Kylian Mbappe", password: "User@123" },
];

async function main() {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;

  for (const u of users) {
    const existing = list?.users.find((x) => x.email?.toLowerCase() === u.email);
    let userId;

    if (existing) {
      userId = existing.id;
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (error) throw new Error(`${u.email}: ${error.message}`);
      console.log(`Updated: ${u.email}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (error) throw new Error(`${u.email}: ${error.message}`);
      userId = data.user.id;
      console.log(`Created: ${u.email}`);
    }

    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({ id: userId, email: u.email, full_name: u.full_name }, { onConflict: "id" });
    if (profileErr) throw new Error(`${u.email} profile: ${profileErr.message}`);

    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: userId, role: "loan_officer" });
    if (roleErr) throw new Error(`${u.email} role: ${roleErr.message}`);

    console.log(`  Role: loan_officer (${u.full_name})`);
  }

  console.log("\nDone. Login at /login with User@123");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
