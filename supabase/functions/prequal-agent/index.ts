/**
 * prequal-agent — Mortgage Pre-Qualification Agent
 * Uses Google Gemini with function calling (agentic loop)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getProviderApiKey } from "../_shared/ai-utils.ts";

const PROFILE_COLUMNS = new Set([
  "borrower_name",
  "annual_income",
  "monthly_debts",
  "assets",
  "employment_type",
  "years_employed",
  "credit_tier",
  "is_veteran",
  "is_first_time_buyer",
  "target_price",
  "down_payment",
  "front_dti",
  "back_dti",
]);

function pickProfileFields(profile: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(profile)) {
    if (PROFILE_COLUMNS.has(key) && value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

const TOOLS = [
  {
    name: "extract_financials",
    description:
      "Extract and store financial data mentioned by the borrower. Call this IMMEDIATELY when ANY financial information is mentioned — income, debts, assets, credit, employment, purchase price, or down payment.",
    input_schema: {
      type: "object",
      properties: {
        annual_income: { type: "number", description: "Annual gross income in USD" },
        monthly_debts: { type: "number", description: "Total monthly debt payments" },
        assets: { type: "number", description: "Total liquid assets in USD" },
        employment_type: { type: "string", enum: ["w2", "self_employed", "contractor", "retired", "other"] },
        years_employed: { type: "number", description: "Years at current employer" },
        credit_tier: {
          type: "string",
          enum: ["excellent", "good", "fair", "poor"],
          description: "excellent=760+, good=700-759, fair=640-699, poor=below 640",
        },
        is_veteran: { type: "boolean" },
        is_first_time_buyer: { type: "boolean" },
        target_price: { type: "number", description: "Target home purchase price in USD" },
        down_payment: { type: "number", description: "Down payment amount in USD" },
      },
      required: [],
    },
  },
  {
    name: "calculate_dti",
    description:
      "Calculate Debt-to-Income ratio. Call when you have: annual_income + monthly_debts + target_price.",
    input_schema: {
      type: "object",
      properties: {
        annual_income: { type: "number" },
        monthly_debts: { type: "number" },
        target_price: { type: "number" },
        down_payment: { type: "number" },
        estimated_rate: { type: "number", description: "Estimated interest rate (use 7.0 if unknown)" },
      },
      required: ["annual_income", "monthly_debts", "target_price", "down_payment"],
    },
  },
  {
    name: "match_loan_products",
    description:
      "Match the borrower to the best loan product. Call when you have: target_price, down_payment, annual_income, credit_tier.",
    input_schema: {
      type: "object",
      properties: {
        target_price: { type: "number" },
        down_payment: { type: "number" },
        annual_income: { type: "number" },
        credit_tier: { type: "string", enum: ["excellent", "good", "fair", "poor"] },
        is_veteran: { type: "boolean" },
        monthly_debts: { type: "number" },
      },
      required: ["target_price", "down_payment", "annual_income", "credit_tier"],
    },
  },
  {
    name: "check_document_gaps",
    description:
      "Generate a document checklist based on employment type and loan product. Call after loan product is matched.",
    input_schema: {
      type: "object",
      properties: {
        employment_type: { type: "string", enum: ["w2", "self_employed", "contractor", "retired", "other"] },
        loan_product: { type: "string", enum: ["Conventional", "FHA", "VA", "USDA"] },
        is_veteran: { type: "boolean" },
      },
      required: ["employment_type", "loan_product"],
    },
  },
  {
    name: "generate_prequal_letter",
    description:
      "Generate the pre-qualification letter. Call ONLY after: borrower_name confirmed, loan product matched, all key data collected.",
    input_schema: {
      type: "object",
      properties: {
        borrower_name: { type: "string" },
        prequal_amount: { type: "number" },
        loan_product: { type: "string" },
        purchase_price: { type: "number" },
      },
      required: ["borrower_name", "prequal_amount", "loan_product", "purchase_price"],
    },
  },
  {
    name: "route_to_officer",
    description: "Assign a loan officer to the borrower. Call immediately after generate_prequal_letter.",
    input_schema: {
      type: "object",
      properties: {
        loan_product: { type: "string" },
        credit_tier: { type: "string" },
      },
      required: ["loan_product"],
    },
  },
];

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
};

const GEMINI_TOOLS = [{
  functionDeclarations: TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  })),
}];

function toGeminiContents(messages: Array<{ role: string; content: string }>): GeminiContent[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

async function listGeminiModels(apiKey: string): Promise<string[]> {
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const listRes = await fetch(listUrl, { method: "GET" });
  if (!listRes.ok) return [];
  const raw = await listRes.json() as {
    models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  };
  return (raw.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => (m.name ?? "").replace(/^models\//, ""))
    .filter((m) => m.length > 0);
}

async function callGemini(
  apiKey: string,
  model: string,
  contents: GeminiContent[],
): Promise<{ ok: boolean; status: number; data: Record<string, unknown>; text: string }> {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: GEMINI_TOOLS,
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // non-JSON error body
  }
  return { ok: response.ok, status: response.status, data, text };
}

function executeTool(
  name: string,
  input: Record<string, unknown>,
  profile: Record<string, unknown>,
) {
  if (name === "extract_financials") {
    const updated = { ...profile, ...input };
    return {
      result: JSON.stringify({ success: true, extracted: input, profile: updated }),
      profile: updated,
    };
  }

  if (name === "calculate_dti") {
    const income = (input.annual_income as number) || 0;
    const debts = (input.monthly_debts as number) || 0;
    const price = (input.target_price as number) || 0;
    const down = (input.down_payment as number) || 0;
    const rate = ((input.estimated_rate as number) || 7.0) / 100 / 12;
    const loanAmt = price - down;
    const n = 360;
    const pi = rate > 0
      ? (loanAmt * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)
      : loanAmt / n;
    const monthlyIncome = income / 12;
    const frontDti = monthlyIncome > 0 ? Math.round((pi / monthlyIncome) * 1000) / 10 : 0;
    const backDti = monthlyIncome > 0
      ? Math.round(((pi + debts) / monthlyIncome) * 1000) / 10
      : 0;
    const status = backDti <= 36 ? "excellent" : backDti <= 43 ? "acceptable" : "high";
    const updated = { ...profile, front_dti: frontDti, back_dti: backDti };
    return {
      result: JSON.stringify({ front_dti: frontDti, back_dti: backDti, status, monthly_pi: Math.round(pi) }),
      profile: updated,
    };
  }

  if (name === "match_loan_products") {
    const price = (input.target_price as number) || 0;
    const down = (input.down_payment as number) || 0;
    const income = (input.annual_income as number) || 0;
    const credit = (input.credit_tier as string) || "good";
    const isVet = (input.is_veteran as boolean) || false;
    const debts = (input.monthly_debts as number) || 0;
    const ltv = price > 0 ? Math.round(((price - down) / price) * 100) : 0;
    const downPct = price > 0 ? (down / price) * 100 : 0;

    let product = "Conventional";
    let rate = 7.1;
    if (isVet) {
      product = "VA";
      rate = 6.75;
    } else if (credit === "fair" || credit === "poor" || downPct < 10) {
      product = "FHA";
      rate = 7.85;
    } else if (credit === "excellent") {
      rate = 6.85;
    }

    const rateAdj = { excellent: -0.25, good: 0, fair: 0.5, poor: 1.0 }[credit] ?? 0;
    if (product === "Conventional") rate += rateAdj;

    const loanAmt = price - down;
    const r = rate / 100 / 12;
    const n = 360;
    const payment = r > 0
      ? Math.round((loanAmt * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1))
      : Math.round(loanAmt / n);
    const maxBack = 0.43;
    const monthlyIncome = income / 12;
    const maxPayment = monthlyIncome * maxBack - debts;
    const maxLoan = r > 0
      ? (maxPayment * (Math.pow(1 + r, n) - 1)) / (r * Math.pow(1 + r, n))
      : maxPayment * n;
    const prequalAmt = Math.round(Math.min(maxLoan + down, price) / 1000) * 1000;

    const match = {
      product_type: product,
      prequal_amount: prequalAmt,
      loan_amount: loanAmt,
      down_payment: down,
      ltv,
      estimated_rate: rate,
      monthly_payment: payment,
    };
    return { result: JSON.stringify(match), profile: { ...profile, ...match } };
  }

  if (name === "check_document_gaps") {
    const emp = input.employment_type as string;
    const loan = input.loan_product as string;
    const docs: string[] = [
      "Government-issued photo ID",
      "Social Security number",
      "Bank statements (last 2 months)",
    ];
    if (emp === "w2") docs.push("W-2 forms (last 2 years)", "Pay stubs (last 30 days)");
    if (emp === "self_employed") {
      docs.push(
        "Tax returns (last 2 years)",
        "Year-to-date P&L statement",
        "Business bank statements (last 3 months)",
      );
    }
    if (emp === "contractor") docs.push("1099 forms (last 2 years)", "Signed contracts showing income");
    if (emp === "retired") docs.push("Pension/Social Security award letters", "Retirement account statements");
    if (loan === "FHA") docs.push("FHA case number (assigned by lender)");
    if (loan === "VA") docs.push("Certificate of Eligibility (VA Form 26-1880)", "DD-214 discharge papers");
    if (loan === "USDA") docs.push("Property address for USDA eligibility check");
    return { result: JSON.stringify({ documents: docs }), profile };
  }

  if (name === "generate_prequal_letter") {
    return {
      result: JSON.stringify({
        success: true,
        borrower_name: input.borrower_name,
        prequal_amount: input.prequal_amount,
        loan_product: input.loan_product,
        purchase_price: input.purchase_price,
        letter_generated: true,
        message: "Letter data ready. PDF will be generated client-side using jsPDF.",
      }),
      profile: { ...profile, borrower_name: input.borrower_name, letter_ready: true, letter_data: input },
    };
  }

  if (name === "route_to_officer") {
    const officers: Record<string, string[]> = {
      VA: ["James Rodriguez", "Patricia Chen"],
      FHA: ["David Thompson", "Maria Santos"],
      Conventional: ["Sarah Mitchell", "Robert Kim"],
      USDA: ["Linda Foster", "Mark Williams"],
    };
    const list = officers[input.loan_product as string] ?? ["Sarah Mitchell"];
    const assigned = list[Math.floor(Math.random() * list.length)];
    return {
      result: JSON.stringify({ assigned_officer: assigned, followup_hours: 24 }),
      profile: { ...profile, assigned_officer: assigned },
    };
  }

  return { result: JSON.stringify({ error: "Unknown tool" }), profile };
}

const SYSTEM_PROMPT = `You are Alex, a friendly and knowledgeable mortgage pre-qualification specialist at MCT Mortgage.

Your job is to help borrowers get pre-qualified through natural conversation — no forms, no jargon. You gather financial information organically and guide borrowers step by step.

## Personality
- Warm, encouraging, professional
- Celebrate milestones: "Great news — your DTI looks strong! ✅"
- Explain financial concepts simply
- Keep messages concise: 2-4 short paragraphs max

## Information to collect (in rough order)
1. Target purchase price and down payment
2. Annual gross income
3. Monthly debt payments (car, student, credit cards)
4. Employment type and years at job
5. Credit score tier (excellent/good/fair/poor)
6. Veteran status
7. First-time buyer status
8. Full legal name (only when ready to generate the letter)

## Tool usage rules — STRICT
- Call extract_financials IMMEDIATELY whenever ANY financial data is mentioned
- Call calculate_dti after you have income + debts + price + down payment
- Call match_loan_products after credit tier + price + down payment + income
- Call check_document_gaps after loan product is matched
- Call generate_prequal_letter ONLY after confirming all data AND getting full name
- Call route_to_officer immediately after generate_prequal_letter
- You may chain multiple tools in one turn

## After each tool result
- extract_financials: briefly confirm what you captured, ask next question
- calculate_dti: share DTI with emoji (✅ ≤36% / ⚠️ 37-43% / ❌ >43%)
- match_loan_products: explain why this product fits them specifically
- check_document_gaps: present as a simple checklist
- generate_prequal_letter: congratulate them enthusiastically
- route_to_officer: introduce their assigned officer warmly

Start by asking about their home purchase goal and target price range.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await authClient.auth.getUser(jwt);
    const user = userData?.user;
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { messages, session_id, profile: incomingProfile, user_message } = body as {
      messages?: Array<{ role: string; content: string }>;
      session_id?: string;
      profile?: Record<string, unknown>;
      user_message?: string;
    };

    let sessionId = session_id as string | undefined;
    let profile: Record<string, unknown> = incomingProfile ?? {};

    if (!sessionId) {
      const { data: session, error: sessionError } = await supabase
        .from("prequal_sessions")
        .insert({ user_id: user.id, status: "active" })
        .select("id")
        .single();
      if (sessionError) throw sessionError;
      sessionId = session?.id;
    }

    const apiKey = await getProviderApiKey("google");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key not configured (set GEMINI_API_KEY or GOOGLE_AI_API_KEY)" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allMessages = [...(messages ?? [])];
    let finalText = "";
    let letterData: Record<string, unknown> | null = null;
    let documentGaps: string[] = [];
    let loanMatch: Record<string, unknown> | null = null;
    let assignedOfficer: string | undefined;
    const MAX_LOOPS = 10;

    let geminiContents = toGeminiContents(allMessages);
    let activeModel = GEMINI_MODEL;

    for (let i = 0; i < MAX_LOOPS; i++) {
      let callResult = await callGemini(apiKey, activeModel, geminiContents);

      const googleErr = callResult.data.error as { status?: string } | undefined;
      const shouldRetryModel =
        !callResult.ok &&
        (callResult.status === 404 || googleErr?.status === "NOT_FOUND");

      if (shouldRetryModel) {
        const available = await listGeminiModels(apiKey);
        const fallback = GEMINI_FALLBACK_MODELS.find((m) => available.includes(m)) ?? available[0];
        if (fallback && fallback !== activeModel) {
          activeModel = fallback;
          callResult = await callGemini(apiKey, activeModel, geminiContents);
        }
      }

      if (!callResult.ok) {
        throw new Error(`Gemini API error (${callResult.status}): ${callResult.text}`);
      }

      const candidates = callResult.data.candidates as Array<{ content?: { parts?: GeminiPart[] } }> | undefined;
      const parts = candidates?.[0]?.content?.parts ?? [];

      const textParts = parts
        .filter((p): p is { text: string } => "text" in p && typeof p.text === "string")
        .map((p) => p.text)
        .join("\n");
      if (textParts) finalText = textParts;

      const functionCalls = parts
        .filter((p): p is { functionCall: { name: string; args: Record<string, unknown> } } =>
          "functionCall" in p && !!p.functionCall
        )
        .map((p) => p.functionCall);

      if (functionCalls.length === 0) break;

      geminiContents.push({ role: "model", parts });

      const responseParts: GeminiPart[] = functionCalls.map((fc) => {
        const { result, profile: updatedProfile } = executeTool(fc.name, fc.args ?? {}, profile);
        profile = updatedProfile;

        if (fc.name === "generate_prequal_letter") letterData = fc.args ?? {};
        if (fc.name === "check_document_gaps") {
          const parsed = JSON.parse(result);
          documentGaps = parsed.documents ?? [];
        }
        if (fc.name === "match_loan_products") loanMatch = JSON.parse(result);
        if (fc.name === "route_to_officer") assignedOfficer = JSON.parse(result).assigned_officer;

        return {
          functionResponse: {
            name: fc.name,
            response: JSON.parse(result) as Record<string, unknown>,
          },
        };
      });

      geminiContents.push({ role: "user", parts: responseParts });
    }

    if (sessionId) {
      try {
        if (user_message) {
          await supabase.from("prequal_messages").insert({
            session_id: sessionId,
            role: "user",
            content: user_message,
          });
        }
        if (finalText) {
          await supabase.from("prequal_messages").insert({
            session_id: sessionId,
            role: "assistant",
            content: finalText,
          });
        }
        const profileFields = pickProfileFields(profile);
        if (Object.keys(profileFields).length > 0) {
          await supabase.from("prequal_profiles").upsert(
            { session_id: sessionId, ...profileFields, updated_at: new Date().toISOString() },
            { onConflict: "session_id" },
          );
        }
        if (loanMatch) {
          const matchData = {
            session_id: sessionId,
            borrower_name: (profile.borrower_name as string) ?? null,
            product_type: loanMatch.product_type,
            prequal_amount: loanMatch.prequal_amount,
            loan_amount: loanMatch.loan_amount,
            down_payment: loanMatch.down_payment,
            ltv: loanMatch.ltv,
            estimated_rate: loanMatch.estimated_rate,
            monthly_payment: loanMatch.monthly_payment,
            back_dti: profile.back_dti ?? null,
            credit_tier: (profile.credit_tier as string) ?? null,
            status: letterData ? "qualified" : "pending",
            letter_generated: !!letterData,
            assigned_officer: assignedOfficer ?? null,
          };
          await supabase.from("prequal_loan_matches").upsert(matchData, { onConflict: "session_id" });
        }
        if (documentGaps.length > 0) {
          const items = documentGaps.map((doc) => ({
            session_id: sessionId,
            document_name: doc,
            required: true,
            collected: false,
          }));
          await supabase.from("prequal_document_items").upsert(items, {
            onConflict: "session_id,document_name",
          });
        }
        if (letterData) {
          await supabase.from("prequal_sessions").update({ status: "completed" }).eq("id", sessionId);
        }
      } catch (e) {
        console.error("Persist error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        message: finalText,
        session_id: sessionId,
        profile,
        letter_data: letterData,
        document_gaps: documentGaps,
        loan_match: loanMatch,
        assigned_officer: assignedOfficer,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("prequal-agent error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
