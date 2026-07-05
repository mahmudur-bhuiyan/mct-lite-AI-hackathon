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
  resolveLoanMatchForPersist,
  formatSessionTitle,
  type LetterData,
  type LoanMatch,
} from "../_shared/prequal-tools.ts";

const TOOLS = [
  {
    name: "extract_financials",
    description:
      "Extract and store profile fields the borrower explicitly stated. Call IMMEDIATELY when ANY of these are mentioned: name, email, income, debts, assets, credit, employment, purchase price, down payment, veteran status, or first-time buyer status. Only include fields the borrower actually said — never invent defaults (e.g. do not assume 20% down).",
    input_schema: {
      type: "object",
      properties: {
        borrower_name: { type: "string", description: "Borrower's full legal name as stated or confirmed" },
        borrower_email: { type: "string", description: "Borrower's email address as stated" },
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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim();
  if (!trimmed) return false;
  return /^\+?[\d\s\-()]+$/.test(trimmed);
}

function buildSystemPrompt(contact?: { name?: string; email?: string; phone?: string; isGuest?: boolean }): string {
  let extra = "";
  if (contact?.name) {
    extra += `\n\n## Contact on file\n- Name: ${contact.name} — you may greet them by first name, but you MUST still ask them to confirm their full legal name before calling generate_prequal_letter.\n`;
  }
  if (contact?.email) {
    extra += `- Email: ${contact.email} (on file for their loan officer; do not repeat the full email unless confirming contact preferences)\n`;
  }
  if (contact?.phone) {
    extra += `- Phone: ${contact.phone} (on file for follow-up; do not repeat unless confirming contact preferences)\n`;
  }
  if (contact?.isGuest) {
    extra += `- This borrower is chatting without an account. After pre-qualification (or if they pause), warmly suggest they sign in or create an account so their loan officer can follow up and they can track their application.\n`;
  }
  return SYSTEM_PROMPT + extra;
}

function toChatMessages(
  messages: Array<{ role: string; content: string }>,
  contact?: { name?: string; email?: string; phone?: string; isGuest?: boolean },
): ChatMessage[] {
  return [
    { role: "system", content: buildSystemPrompt(contact) },
    ...messages.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    })),
  ];
}

const SYSTEM_PROMPT = `You are Alex, a friendly and knowledgeable mortgage pre-qualification specialist at MCT Mortgage.

Your job is to help borrowers get pre-qualified through natural conversation — no forms, no jargon. You gather financial information organically and guide borrowers step by step.

The Live Eligibility Scorecard on the right updates from extract_financials. Every detail the borrower shares must be captured there.

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
8. Full legal name — confirm explicitly even if we already have a name on file (required before generate_prequal_letter)
9. Email — if not already on file, ask once before the letter

## Name confirmation — STRICT
- If a name was provided at sign-in or intake, still ask: "Just to confirm for your pre-qualification letter, what is your full legal name?"
- When they confirm, call extract_financials with borrower_name
- Only call generate_prequal_letter after the borrower confirms their full legal name in the conversation

## Extraction accuracy — STRICT
- Only pass fields the borrower explicitly stated in this conversation
- Never invent, estimate, or assume values (no default 20% down payment, no guessed income/credit)
- Parse informal amounts: "100k" → 100000, "200k a year" → annual_income 200000, "20%" of a known price → down_payment amount
- If they give a range, use the midpoint and confirm it briefly

## Tool usage rules — STRICT
- Call extract_financials IMMEDIATELY whenever ANY profile field is mentioned (including name and email)
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

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      messages,
      session_id,
      session_token,
      profile: incomingProfile,
      user_message,
      init_guest,
      contact,
    } = body as {
      messages?: Array<{ role: string; content: string }>;
      session_id?: string;
      session_token?: string;
      profile?: Record<string, unknown>;
      user_message?: string;
      init_guest?: { name?: string; email?: string; phone?: string };
      contact?: { name?: string; email?: string; phone?: string };
    };

    type GuestContext = {
      guestName: string;
      guestEmail: string;
      guestPhone?: string;
      isGuest: true;
    };
    type UserContext = {
      userId: string;
      contactName?: string;
      contactEmail?: string;
      isGuest: false;
    };

    let actor: UserContext | GuestContext | null = null;
    let sessionId = session_id as string | undefined;
    let sessionToken: string | undefined = session_token;
    let profile: Record<string, unknown> = incomingProfile ?? {};

    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: authError } = await authClient.auth.getUser(jwt);
      const user = userData?.user;
      if (!authError && user) {
        actor = {
          userId: user.id,
          contactName: contact?.name ?? (user.user_metadata?.full_name as string | undefined) ?? (user.user_metadata?.name as string | undefined),
          contactEmail: contact?.email ?? user.email ?? undefined,
          isGuest: false,
        };
      }
    }

    if (!actor) {
      if (init_guest?.name && init_guest?.email) {
      const guestName = String(init_guest.name).trim().slice(0, 120);
      const guestEmail = String(init_guest.email).trim().toLowerCase().slice(0, 254);
      const guestPhoneRaw = init_guest.phone ? String(init_guest.phone).trim().slice(0, 50) : "";
      const guestPhone = guestPhoneRaw || undefined;
      if (!guestName || !isValidEmail(guestEmail)) {
        return new Response(JSON.stringify({ error: "Valid name and email are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (guestPhone && !isValidPhone(guestPhone)) {
        return new Response(JSON.stringify({ error: "Invalid phone number" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: session, error: sessionError } = await supabase
        .from("prequal_sessions")
        .insert({
          user_id: null,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone ?? null,
          status: "active",
        })
        .select("id, session_token")
        .single();
      if (sessionError) throw sessionError;
      sessionId = session?.id;
      sessionToken = session?.session_token;
      profile = {
        ...profile,
        borrower_name: guestName,
        borrower_email: guestEmail,
        ...(guestPhone ? { borrower_phone: guestPhone } : {}),
      };
      await supabase.from("prequal_profiles").upsert(
        {
          session_id: sessionId,
          borrower_name: guestName,
          borrower_email: guestEmail,
          borrower_phone: guestPhone ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id" },
      );
      actor = { guestName, guestEmail, guestPhone, isGuest: true };

      return new Response(
        JSON.stringify({
          message: null,
          session_id: sessionId,
          session_token: sessionToken,
          profile,
          initialized: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
      } else if (session_id && session_token) {
      const { data: session, error: sessionError } = await supabase
        .from("prequal_sessions")
        .select("id, session_token, guest_name, guest_email, guest_phone, user_id")
        .eq("id", session_id)
        .single();
      if (sessionError || !session || session.session_token !== session_token || session.user_id) {
        return new Response(JSON.stringify({ error: "Invalid guest session" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      sessionId = session.id;
      sessionToken = session.session_token;
      actor = {
        guestName: session.guest_name ?? "Guest",
        guestEmail: session.guest_email ?? "",
        guestPhone: session.guest_phone ?? undefined,
        isGuest: true,
      };
      if (!profile.borrower_name && session.guest_name) profile.borrower_name = session.guest_name;
      if (!profile.borrower_email && session.guest_email) profile.borrower_email = session.guest_email;
      if (!profile.borrower_phone && session.guest_phone) profile.borrower_phone = session.guest_phone;
      } else {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!sessionId && actor && !actor.isGuest) {
      const contactName = actor.contactName;
      const contactEmail = actor.contactEmail;
      const { data: session, error: sessionError } = await supabase
        .from("prequal_sessions")
        .insert({
          user_id: actor.userId,
          guest_name: contactName ?? null,
          guest_email: contactEmail ?? null,
          status: "active",
        })
        .select("id, session_token")
        .single();
      if (sessionError) throw sessionError;
      sessionId = session?.id;
      sessionToken = session?.session_token;
    }

    // Always seed contact into the scorecard profile (every turn, not only session create).
    if (actor.isGuest) {
      if (actor.guestName) profile.borrower_name = profile.borrower_name ?? actor.guestName;
      if (actor.guestEmail) profile.borrower_email = profile.borrower_email ?? actor.guestEmail;
      if (actor.guestPhone) profile.borrower_phone = profile.borrower_phone ?? actor.guestPhone;
    } else {
      if (actor.contactName) profile.borrower_name = profile.borrower_name ?? actor.contactName;
      if (actor.contactEmail) profile.borrower_email = profile.borrower_email ?? actor.contactEmail;
    }

    const contactContext = actor.isGuest
      ? {
          name: actor.guestName,
          email: actor.guestEmail,
          phone: actor.guestPhone,
          isGuest: true as const,
        }
      : { name: actor.contactName, email: actor.contactEmail, isGuest: false as const };

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

    const chatMessages = toChatMessages(allMessages, contactContext);

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
          // Name the chat from the first user message (e.g. "condo in 45k").
          const title = formatSessionTitle(user_message);
          if (title) {
            await supabase
              .from("prequal_sessions")
              .update({ title })
              .eq("id", sessionId)
              .is("title", null);
          }
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
        const matchToPersist = resolveLoanMatchForPersist(
          loanMatch as LoanMatch | null,
          profile,
          letterData,
        );
        if (matchToPersist) {
          const pipelineRow = buildPipelineMatchRow(
            sessionId,
            profile,
            matchToPersist,
            letterData,
            assignedOfficer ?? null,
          );
          const { error: matchError } = await supabase.from("prequal_loan_matches").upsert(
            {
              ...pipelineRow,
              down_payment: matchToPersist.down_payment,
              ltv: matchToPersist.ltv,
            },
            { onConflict: "session_id" },
          );
          if (matchError) console.error("Loan match persist error:", matchError.message);
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
        session_token: sessionToken,
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

