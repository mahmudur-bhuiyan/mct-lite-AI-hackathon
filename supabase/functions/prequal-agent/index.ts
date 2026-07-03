/**
 * prequal-agent — Mortgage Pre-Qualification Agent
 * Uses OpenAI with function calling (agentic loop)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getOpenAIApiKey,
  chatCompletion,
  type ChatMessage,
  type ToolDefinition,
} from "../_shared/ai-utils.ts";
import {
  pickProfileFields,
  executeTool,
  buildPipelineMatchRow,
  type LetterData,
  type LoanMatch,
} from "../_shared/prequal-tools.ts";

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

const OPENAI_MODEL = "gpt-4o-mini";

const OPENAI_TOOLS: ToolDefinition[] = TOOLS.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  },
}));

function formatUserFacingAiError(raw: string, fallback = "Something went wrong. Please try again."): string {
  let msg = raw.trim();
  if (!msg) return fallback;

  msg = msg.replace(/^Error:\s*/i, "");
  msg = msg.replace(/^(?:Gemini|OpenAI|Anthropic|Google|Lovable AI)\s+API error\s*\(\d+\):\s*/i, "");

  const forMoreIdx = msg.indexOf("For more information");
  if (forMoreIdx > 0) msg = msg.slice(0, forMoreIdx).trim();

  const urlIdx = msg.search(/https?:\/\//);
  if (urlIdx > 0) msg = msg.slice(0, urlIdx).trim();

  msg = msg
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("*") && !/^Please retry in/i.test(line))
    .join(" ")
    .trim();

  msg = msg.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
  if (msg && !/[.!?]$/.test(msg)) msg += ".";

  if (msg.length > 220) {
    const sentence = msg.match(/^[^.!?]+[.!?]/);
    if (sentence) msg = sentence[0];
  }

  return msg || fallback;
}

function toChatMessages(messages: Array<{ role: string; content: string }>): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    })),
  ];
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

    const apiKey = await getOpenAIApiKey();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key not configured (set OPENAI_API_KEY)" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allMessages = [...(messages ?? [])];
    let finalText = "";
    let letterData: LetterData | null = null;
    let documentGaps: string[] = [];
    let loanMatch: Record<string, unknown> | null = null;
    let assignedOfficer: string | undefined;
    const MAX_LOOPS = 10;

    const chatMessages = toChatMessages(allMessages);

    for (let i = 0; i < MAX_LOOPS; i++) {
      let raw: Record<string, unknown>;
      try {
        raw = await chatCompletion(apiKey, chatMessages, {
          model: OPENAI_MODEL,
          max_tokens: 1024,
          temperature: 0.7,
          tools: OPENAI_TOOLS,
          tool_choice: "auto",
        });
      } catch (err) {
        const openAiMessage = err instanceof Error ? err.message : String(err);
        console.error("OpenAI API error:", openAiMessage);
        throw new Error(formatUserFacingAiError(openAiMessage));
      }

      const choice = ((raw.choices as Array<{
        finish_reason?: string;
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>) ?? [])[0];

      const assistantMessage = choice?.message;
      if (assistantMessage?.content) finalText = assistantMessage.content;

      const toolCalls = assistantMessage?.tool_calls ?? [];
      if (choice?.finish_reason !== "tool_calls" || toolCalls.length === 0) break;

      chatMessages.push({
        role: "assistant",
        content: assistantMessage?.content ?? null,
        tool_calls: toolCalls,
      });

      for (const tc of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          // use empty args
        }

        const { result, profile: updatedProfile } = executeTool(tc.function.name, args, profile);
        profile = updatedProfile;

        if (tc.function.name === "generate_prequal_letter") {
          letterData = {
            borrower_name: args.borrower_name as string,
            prequal_amount: args.prequal_amount as number,
            loan_product: args.loan_product as string,
            purchase_price: args.purchase_price as number,
          };
        }
        if (tc.function.name === "check_document_gaps") {
          const parsed = JSON.parse(result);
          documentGaps = parsed.documents ?? [];
        }
        if (tc.function.name === "match_loan_products") loanMatch = JSON.parse(result);
        if (tc.function.name === "route_to_officer") assignedOfficer = JSON.parse(result).assigned_officer;

        chatMessages.push({
          role: "tool",
          content: result,
          tool_call_id: tc.id,
          name: tc.function.name,
        });
      }
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
          const match = loanMatch as LoanMatch;
          const pipelineRow = buildPipelineMatchRow(
            sessionId,
            profile,
            match,
            letterData,
            assignedOfficer ?? null,
          );
          await supabase.from("prequal_loan_matches").upsert(
            {
              ...pipelineRow,
              down_payment: match.down_payment,
              ltv: match.ltv,
            },
            { onConflict: "session_id" },
          );
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
    const raw = err instanceof Error ? err.message : String(err);
    const error = formatUserFacingAiError(raw);
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
