/**
 * Pre-qual agent smoke test: deterministic tool chain + optional live edge function call.
 *
 * Usage: npm run smoke:prequal
 */
import { createClient, FunctionsHttpError } from "@supabase/supabase-js";
import { runPrequalScenario } from "../supabase/functions/_shared/prequal-tools.ts";

async function extractInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const body = await error.context.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // ignore
    }
  }
  return error instanceof Error ? error.message : String(error);
}

async function run(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL: ${name} -> ${msg}`);
    return false;
  }
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const results: boolean[] = [];

  results.push(
    await run("deterministic prequal scenario (John Smith)", async () => {
      const r = runPrequalScenario({
        annual_income: 120_000,
        monthly_debts: 800,
        target_price: 450_000,
        down_payment: 45_000,
        credit_tier: "good",
        employment_type: "w2",
        borrower_name: "John Smith",
      });

      assert(r.loanMatch.product_type === "Conventional", "expected Conventional");
      assert(r.pipelineRow.status === "qualified", "expected qualified status");
      assert(r.pipelineRow.letter_generated === true, "expected letter generated");
      assert(r.assignedOfficer === "Sarah Mitchell", "expected deterministic LO assignment");
      assert(r.pipelineStats.qualified === 1, "expected 1 qualified in stats");

      console.log(
        `  → ${r.letter.borrower_name}: $${r.loanMatch.prequal_amount.toLocaleString()} ${r.loanMatch.product_type} @ ${r.loanMatch.estimated_rate}%`,
      );
    }),
  );

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.PREQUAL_SMOKE_EMAIL ?? "admin@gmail.com";
  const password = process.env.PREQUAL_SMOKE_PASSWORD ?? "Admin@123";

  if (supabaseUrl && anonKey) {
    const auth = createClient(supabaseUrl, anonKey);
    const { data: signIn, error: signErr } = await auth.auth.signInWithPassword({
      email,
      password,
    });

    if (signErr || !signIn.session) {
      console.log(`SKIP: live prequal-agent (${signErr?.message ?? "sign-in failed"})`);
    } else {
      results.push(
        await run("live prequal-agent edge function", async () => {
          const { data, error } = await auth.functions.invoke("prequal-agent", {
            body: {
              messages: [
                {
                  role: "user",
                  content:
                    "I want a $450k home in Austin with $45k down. I earn $120k/year, $800/mo debts, W-2 for 5 years, credit around 740. My name is John Smith.",
                },
              ],
              user_message:
                "I want a $450k home in Austin with $45k down. I earn $120k/year, $800/mo debts, W-2 for 5 years, credit around 740. My name is John Smith.",
            },
          });

          if (error) throw new Error(await extractInvokeError(error));
          if (data?.error) throw new Error(data.error);

          assert(typeof data.message === "string" && data.message.length > 0, "expected assistant message");
          assert(data.session_id, "expected session_id");
          assert(
            data.profile?.target_price === 450_000 || data.profile?.annual_income === 120_000,
            "expected profile extraction",
          );

          if (data.loan_match) {
            console.log(
              `  → live match: ${data.loan_match.product_type} $${data.loan_match.prequal_amount}`,
            );
          } else {
            console.log("  → profile extracted; loan match may need another turn (model-dependent)");
          }
        }),
      );
    }
  } else {
    console.log("SKIP: live prequal-agent (set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY)");
  }

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n${passed}/${total} checks passed`);
  process.exit(passed === total ? 0 : 1);
}

main();
