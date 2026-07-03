import { FunctionsHttpError } from "@supabase/supabase-js";

/** Strip provider/API noise so chat UIs show only the primary error sentence. */
export function formatUserFacingAiError(raw: string, fallback = "Something went wrong. Please try again."): string {
  let msg = raw.trim();
  if (!msg) return fallback;

  msg = msg.replace(/^Error:\s*/i, "");
  msg = msg.replace(/^(?:Gemini|OpenAI|Anthropic|Google|Lovable AI)\s+API error\s*\(\d+\):\s*/i, "");
  msg = msg.replace(/^(?:Lovable AI Gateway error)\s*\(\d+\):\s*/i, "");

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

export async function extractEdgeFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  const err = error as any;
  let msg = (err?.message as string) || fallback;
  const errResponse = err?.response ?? err?.context ?? (error instanceof Response ? error : null);

  try {
    if (errResponse?.clone && typeof errResponse.clone === "function") {
      const text = await errResponse.clone().text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed?.error === "string") msg = parsed.error;
        } catch {
          if (!text.trim().startsWith("<") && text.length < 1200) {
            msg = text.slice(0, 400);
          }
        }
      }
    }
  } catch {
    // best effort
  }

  if (
    msg === fallback &&
    error instanceof FunctionsHttpError &&
    error.context instanceof Response
  ) {
    try {
      const j = await error.context.clone().json();
      if (typeof j?.error === "string") msg = j.error;
    } catch {
      // ignore
    }
  }

  return formatUserFacingAiError(msg, fallback);
}

export function isPersistedRowNewer(args: {
  invokeStartedAt: number;
  beforeId: string | null;
  beforeCreatedAt: string | null;
  latestId: string | null;
  latestCreatedAt: string | null;
  clockSkewMs?: number;
}): boolean {
  const {
    invokeStartedAt,
    beforeId,
    beforeCreatedAt,
    latestId,
    latestCreatedAt,
    clockSkewMs = 5000,
  } = args;

  if (!latestId) return false;
  if (beforeId && latestId !== beforeId) return true;

  const latestMs = latestCreatedAt ? new Date(latestCreatedAt).getTime() : null;
  const createdAfterInvoke = latestMs != null && latestMs >= invokeStartedAt - clockSkewMs;
  const createdAtChanged = beforeCreatedAt ? latestCreatedAt !== beforeCreatedAt : true;
  return Boolean(createdAfterInvoke && createdAtChanged);
}

