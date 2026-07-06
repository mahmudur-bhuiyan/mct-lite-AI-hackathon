import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logCrud } from "@/lib/activity-logger";
import { formatUserFacingAiError } from "@/lib/edgeFunctionUtils";
import { queryKeys } from "@/lib/cache";
import { toast } from "sonner";
import { limitGuestResumeSessions, mergeBorrowerSnapshotIntoProfile } from "../../supabase/functions/_shared/prequal-tools";
import {
  usePrequalMessages,
  usePrequalSessionDetails,
  usePrequalSessions,
} from "@/hooks/usePrequalSessions";

/** Delay between words when revealing an assistant reply (ChatGPT-style). */
const WORD_STREAM_MS = 28;

/**
 * Reveal `text` word-by-word via `onChunk`. Resolves when complete or cancelled.
 * On cancel, flushes the full text so the UI never stays partial.
 */
function streamWords(
  text: string,
  onChunk: (partial: string) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const tokens = text.match(/\S+\s*/g);
  if (!tokens || tokens.length <= 1) {
    onChunk(text);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let i = 0;
    let partial = "";

    const tick = () => {
      if (isCancelled()) {
        onChunk(text);
        resolve();
        return;
      }
      partial += tokens[i++];
      onChunk(partial);
      if (i >= tokens.length) {
        resolve();
        return;
      }
      window.setTimeout(tick, WORD_STREAM_MS);
    };

    tick();
  });
}

export type PrequalAgentMode = "authenticated" | "guest";

export interface PrequalContact {
  name: string;
  email: string;
  phone?: string;
}

export interface GuestPriorSession {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  guest_name: string | null;
  message_count: number;
  preview: string | null;
}

export interface PrequalBorrowerCompletionInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  street_address?: string;
  postal_code?: string;
}

export interface GuestBorrowerProfile {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}

function borrowerProfileFromCompletionInput(
  input: PrequalBorrowerCompletionInput,
): GuestBorrowerProfile {
  return {
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    city: input.city,
    state: input.state,
    street_address: input.street_address ?? null,
    postal_code: input.postal_code ?? null,
  };
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface PrequalProfile {
  annual_income?: number;
  monthly_debts?: number;
  assets?: number;
  employment_type?: string;
  years_employed?: number;
  credit_tier?: string;
  is_veteran?: boolean;
  is_first_time_buyer?: boolean;
  target_price?: number;
  down_payment?: number;
  front_dti?: number;
  back_dti?: number;
  borrower_name?: string;
  borrower_email?: string;
  borrower_phone?: string;
  street_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  assigned_officer?: string;
}

export interface LoanMatch {
  product_type: string;
  prequal_amount: number;
  loan_amount: number;
  down_payment: number;
  ltv: number;
  estimated_rate: number;
  monthly_payment: number;
}

export interface LetterData {
  borrower_name: string;
  prequal_amount: number;
  loan_product: string;
  purchase_price: number;
}

export interface AssignedOfficerProfile {
  user_id?: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  nmls_id: string;
  specialty: string;
}

export const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hi! I'm Alex, your mortgage pre-qualification specialist 👋\n\nI can get you pre-qualified for a home loan in just a few minutes — no paperwork, no forms, just a quick conversation.\n\n**What type of home are you looking to buy, and do you have a target price range in mind?**",
};

const GUEST_STORAGE_KEY = "mct_prequal_guest_session";

interface GuestSessionStored {
  sessionId: string;
  sessionToken: string;
  name: string;
  email: string;
  phone?: string;
}

interface UsePrequalAgentOptions {
  mode?: PrequalAgentMode;
  contact?: PrequalContact | null;
  /** When true, open a blank draft instead of restoring the latest history session. */
  startFresh?: boolean;
}

function toApiMessages(messages: Message[]): Array<{ role: string; content: string }> {
  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  if (firstUserIdx < 0) return [];
  return messages.slice(firstUserIdx).map((m) => ({ role: m.role, content: m.content }));
}

function hydrateMessagesFromRows(rows: Array<{ role: string; content: string }>): Message[] {
  const restored: Message[] = rows
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  if (restored.length === 0) return [INITIAL_MESSAGE];
  if (restored[0]?.role === "assistant") return restored;
  return [INITIAL_MESSAGE, ...restored];
}

async function parseInvokeError(fnError: unknown): Promise<never> {
  const err = fnError as { message?: string; context?: Response };
  if (err.context) {
    try {
      const body = (await err.context.json()) as { error?: string };
      if (body?.error) throw new Error(body.error);
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message !== err.message) throw parseErr;
    }
  }
  throw fnError;
}

type GuestResumePayload = {
  session_id: string;
  session_token: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  profile?: PrequalProfile;
  loan_match?: LoanMatch | null;
  letter_data?: LetterData | null;
  document_gaps?: string[];
  assigned_officer?: string | null;
  assigned_officer_profile?: AssignedOfficerProfile | null;
  borrower_id?: string | null;
  borrower_profile?: GuestBorrowerProfile | null;
  messages?: Array<{ role: string; content: string }>;
};

function buildGuestStored(
  data: GuestResumePayload,
  contact: PrequalContact,
): GuestSessionStored {
  const name = data.guest_name ?? contact.name;
  const email = data.guest_email ?? contact.email;
  const phone = data.guest_phone ?? contact.phone;
  return {
    sessionId: data.session_id,
    sessionToken: data.session_token,
    name,
    email,
    ...(phone ? { phone } : {}),
  };
}

export function usePrequalAgent(options: UsePrequalAgentOptions = {}) {
  const mode = options.mode ?? "authenticated";
  const contact = options.contact ?? null;
  const startFresh = options.startFresh === true;
  const isGuestMode = mode === "guest";

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  /** True while the assistant reply is being revealed word-by-word. */
  const [isStreaming, setIsStreaming] = useState(false);
  const streamCancelRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [guestReady, setGuestReady] = useState(!isGuestMode);
  const [contactName, setContactName] = useState<string | null>(contact?.name ?? null);
  const [contactEmail, setContactEmail] = useState<string | null>(contact?.email ?? null);
  const [isDraftSession, setIsDraftSession] = useState(startFresh);
  const [hasPickedInitialSession, setHasPickedInitialSession] = useState(startFresh);
  const [profile, setProfile] = useState<PrequalProfile>(() => {
    if (!startFresh || isGuestMode) return {};
    return {
      borrower_name: contact?.name?.trim() || undefined,
      borrower_email: contact?.email?.trim() || undefined,
    };
  });
  const [loanMatch, setLoanMatch] = useState<LoanMatch | null>(null);
  const [letterData, setLetterData] = useState<LetterData | null>(null);
  const [documentGaps, setDocumentGaps] = useState<string[]>([]);
  const [assignedOfficer, setAssignedOfficer] = useState<string | null>(null);
  const [assignedOfficerProfile, setAssignedOfficerProfile] = useState<AssignedOfficerProfile | null>(null);
  const [borrowerId, setBorrowerId] = useState<string | null>(null);
  const [existingBorrowerProfile, setExistingBorrowerProfile] =
    useState<GuestBorrowerProfile | null>(null);
  const [creatingBorrower, setCreatingBorrower] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** When true, hydrate scorecard from DB once session details arrive (history load only). */
  const [needsHydration, setNeedsHydration] = useState(false);
  const [isLoadingGuestSession, setIsLoadingGuestSession] = useState(isGuestMode);

  const historyEnabled = !isGuestMode && !!user?.id;
  const { data: sessions = [], isLoading: isLoadingSessions } = usePrequalSessions(
    historyEnabled ? user?.id : undefined,
  );
  const { data: messageRows = [], isLoading: isLoadingMessages } = usePrequalMessages(
    historyEnabled && sessionId ? sessionId : null,
  );
  const { data: sessionDetails, isLoading: isLoadingDetails } = usePrequalSessionDetails(
    historyEnabled && sessionId ? sessionId : null,
  );

  const isLoadingHistory =
    historyEnabled &&
    !isDraftSession &&
    (isLoadingSessions ||
      (!!sessionId && (isLoadingMessages || isLoadingDetails)) ||
      (!hasPickedInitialSession && isLoadingSessions));

  const applyGuestResume = useCallback((data: GuestResumePayload, contact: PrequalContact) => {
    const name = data.guest_name ?? contact.name;
    const email = data.guest_email ?? contact.email;
    const phone = data.guest_phone ?? contact.phone;
    const baseProfile: PrequalProfile =
      data.profile ?? {
        borrower_name: name,
        borrower_email: email,
        ...(phone ? { borrower_phone: phone } : {}),
      };

    setSessionId(data.session_id);
    setSessionToken(data.session_token);
    setContactName(name);
    setContactEmail(email);
    setExistingBorrowerProfile(data.borrower_profile ?? null);
    setProfile(
      mergeBorrowerSnapshotIntoProfile(baseProfile, data.borrower_profile ?? null),
    );
    setLoanMatch(data.loan_match ?? null);
    setLetterData(data.letter_data ?? null);
    setDocumentGaps(data.document_gaps ?? []);
    setAssignedOfficer(data.assigned_officer ?? null);
    setAssignedOfficerProfile(data.assigned_officer_profile ?? null);
    setBorrowerId(data.borrower_id ?? null);
    setMessages(hydrateMessagesFromRows(data.messages ?? []));
    setGuestReady(true);
    localStorage.setItem(
      GUEST_STORAGE_KEY,
      JSON.stringify(buildGuestStored(data, { name, email, phone })),
    );
  }, []);

  useEffect(() => {
    if (!isGuestMode) return;
    let cancelled = false;

    (async () => {
      try {
        const raw = localStorage.getItem(GUEST_STORAGE_KEY);
        if (!raw) {
          if (!cancelled) setIsLoadingGuestSession(false);
          return;
        }
        const stored = JSON.parse(raw) as GuestSessionStored;
        if (!stored.sessionId || !stored.sessionToken) {
          localStorage.removeItem(GUEST_STORAGE_KEY);
          if (!cancelled) setIsLoadingGuestSession(false);
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke("prequal-agent", {
          body: {
            resume_guest: true,
            session_id: stored.sessionId,
            session_token: stored.sessionToken,
          },
        });
        if (cancelled) return;
        if (fnError) await parseInvokeError(fnError);
        if (data?.error || !data?.resumed) {
          localStorage.removeItem(GUEST_STORAGE_KEY);
          setIsLoadingGuestSession(false);
          return;
        }

        applyGuestResume(data as GuestResumePayload, {
          name: stored.name,
          email: stored.email,
          ...(stored.phone ? { phone: stored.phone } : {}),
        });
        if (!cancelled) setIsLoadingGuestSession(false);
      } catch {
        localStorage.removeItem(GUEST_STORAGE_KEY);
        if (!cancelled) setIsLoadingGuestSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isGuestMode, applyGuestResume]);

  useEffect(() => {
    if (!historyEnabled || isDraftSession || hasPickedInitialSession || isLoadingSessions) return;
    if (sessions.length === 0) {
      setHasPickedInitialSession(true);
      return;
    }
    const latest = sessions[0];
    if (latest?.id) {
      setSessionId(latest.id);
      setNeedsHydration(true);
      setHasPickedInitialSession(true);
    }
  }, [sessions, isDraftSession, hasPickedInitialSession, isLoadingSessions, historyEnabled]);

  useEffect(() => {
    if (!historyEnabled || loading || isStreaming) return;
    if (!sessionId) {
      if (isDraftSession) setMessages([INITIAL_MESSAGE]);
      return;
    }
    const restored: Message[] = messageRows.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    setMessages(hydrateMessagesFromRows(restored));
  }, [messageRows, sessionId, loading, isStreaming, isDraftSession, historyEnabled]);

  // Hydrate scorecard from DB only when loading a history session — never overwrite live agent updates.
  useEffect(() => {
    if (!historyEnabled || !needsHydration || !sessionId || !sessionDetails || loading || isStreaming) return;
    setProfile(sessionDetails.profile);
    setLoanMatch(sessionDetails.loanMatch);
    setLetterData(sessionDetails.letterData);
    setDocumentGaps(sessionDetails.documentGaps);
    setAssignedOfficer(sessionDetails.assignedOfficer);
    setAssignedOfficerProfile(null);
    setNeedsHydration(false);
  }, [sessionDetails, sessionId, loading, isStreaming, historyEnabled, needsHydration]);

  // Seed signed-in contact onto the scorecard when profile fields are still empty.
  // Re-runs after history hydration (needsHydration) so DB rows without name/email still show identity.
  useEffect(() => {
    if (isGuestMode || needsHydration) return;
    const name = contact?.name?.trim();
    const email = contact?.email?.trim();
    if (!name && !email) return;
    setProfile((prev) => {
      const nextName = prev.borrower_name || name || undefined;
      const nextEmail = prev.borrower_email || email || undefined;
      if (nextName === prev.borrower_name && nextEmail === prev.borrower_email) return prev;
      return { ...prev, borrower_name: nextName, borrower_email: nextEmail };
    });
  }, [isGuestMode, contact?.name, contact?.email, needsHydration]);

  useEffect(() => {
    if (!existingBorrowerProfile) return;
    setProfile((prev) => mergeBorrowerSnapshotIntoProfile(prev, existingBorrowerProfile));
  }, [existingBorrowerProfile]);

  const invalidateSessionQueries = useCallback(
    (sid: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prequal.messages(sid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.prequal.session(sid) });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.prequal.sessions(user.id) });
      }
    },
    [queryClient, user?.id],
  );

  const loadSession = useCallback((id: string) => {
    if (id === sessionId) return;
    streamCancelRef.current = true;
    setIsStreaming(false);
    setIsDraftSession(false);
    setSessionId(id);
    setNeedsHydration(true);
    setProfile({});
    setLoanMatch(null);
    setLetterData(null);
    setDocumentGaps([]);
    setAssignedOfficer(null);
    setAssignedOfficerProfile(null);
    setBorrowerId(null);
    setExistingBorrowerProfile(null);
    setError(null);
  }, [sessionId]);

  const createBorrowerFromPrequal = useCallback(
    async (input: PrequalBorrowerCompletionInput) => {
      if (!sessionId || !sessionToken) throw new Error("Guest session not initialized");

      setCreatingBorrower(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("prequal-agent", {
          body: {
            create_borrower: {
              session_id: sessionId,
              session_token: sessionToken,
              first_name: input.first_name,
              last_name: input.last_name,
              email: input.email,
              phone: input.phone,
              city: input.city,
              state: input.state,
              street_address: input.street_address,
              postal_code: input.postal_code,
            },
          },
        });
        if (fnError) await parseInvokeError(fnError);
        if (data?.error) throw new Error(data.error);
        if (!data?.borrower_id) throw new Error("Could not save your profile");

        setBorrowerId(data.borrower_id as string);
        const savedProfile = borrowerProfileFromCompletionInput(input);
        setExistingBorrowerProfile(savedProfile);
        setProfile((prev) => mergeBorrowerSnapshotIntoProfile(prev, savedProfile));
        const updated = data.updated === true;
        toast.success(updated ? "Profile updated" : "Profile saved", {
          description: updated
            ? "Your contact details have been updated."
            : "Your loan officer can now follow up with you.",
        });
        return data.borrower_id as string;
      } finally {
        setCreatingBorrower(false);
      }
    },
    [sessionId, sessionToken],
  );

  const startGuestSession = useCallback(async (guest: PrequalContact) => {
    const name = guest.name.trim();
    const email = guest.email.trim().toLowerCase();
    const phone = guest.phone?.trim() || undefined;
    if (!name || !email) throw new Error("Name and email are required");

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("prequal-agent", {
        body: { init_guest: { name, email, ...(phone ? { phone } : {}) } },
      });
      if (fnError) await parseInvokeError(fnError);
      if (data?.error) throw new Error(data.error);
      if (!data?.session_id || !data?.session_token) {
        throw new Error("Could not start guest session");
      }

      setSessionId(data.session_id);
      setSessionToken(data.session_token);
      setContactName(name);
      setContactEmail(email);
      const borrowerProfile =
        (data.borrower_profile as GuestBorrowerProfile | null | undefined) ?? null;
      setBorrowerId((data.borrower_id as string | null | undefined) ?? null);
      setExistingBorrowerProfile(borrowerProfile);
      const baseProfile: PrequalProfile =
        (data.profile as PrequalProfile) ?? {
          borrower_name: name,
          borrower_email: email,
          ...(phone ? { borrower_phone: phone } : {}),
        };
      setProfile(mergeBorrowerSnapshotIntoProfile(baseProfile, borrowerProfile));
      setGuestReady(true);
      setMessages([INITIAL_MESSAGE]);

      localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({
          sessionId: data.session_id,
          sessionToken: data.session_token,
          name,
          email,
          ...(phone ? { phone } : {}),
        } satisfies GuestSessionStored),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const lookupGuestSessions = useCallback(async (email: string): Promise<GuestPriorSession[]> => {
    const normalized = email.trim().toLowerCase();
    const { data, error: fnError } = await supabase.functions.invoke("prequal-agent", {
      body: { lookup_guest_sessions: { email: normalized } },
    });
    if (fnError) await parseInvokeError(fnError);
    if (data?.error) throw new Error(data.error);
    return limitGuestResumeSessions((data?.sessions as GuestPriorSession[] | undefined) ?? []);
  }, []);

  const resumeGuestByEmail = useCallback(
    async (contact: PrequalContact, priorSessionId: string) => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("prequal-agent", {
          body: {
            resume_guest_by_email: {
              email: contact.email.trim().toLowerCase(),
              session_id: priorSessionId,
            },
          },
        });
        if (fnError) await parseInvokeError(fnError);
        if (data?.error || !data?.resumed) {
          throw new Error(data?.error ?? "Could not resume your conversation");
        }
        applyGuestResume(data as GuestResumePayload, contact);
      } finally {
        setLoading(false);
      }
    },
    [applyGuestResume],
  );

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || loading || isStreaming) return;
      if (isGuestMode && !guestReady) return;

      const userMsg: Message = { role: "user", content: userText };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setLoading(true);
      setError(null);
      streamCancelRef.current = false;

      try {
        if (!isGuestMode) {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) throw new Error("Not authenticated");
        }

        const body: Record<string, unknown> = {
          messages: toApiMessages(newMessages),
          session_id: sessionId,
          profile,
          user_message: userText,
        };

        if (isGuestMode) {
          if (!sessionId || !sessionToken) throw new Error("Guest session not initialized");
          body.session_token = sessionToken;
        } else if (contact?.name || contact?.email) {
          body.contact = contact;
        }

        const { data, error: fnError } = await supabase.functions.invoke("prequal-agent", { body });
        if (fnError) await parseInvokeError(fnError);
        if (data?.error) throw new Error(data.error);

        // Apply scorecard / session metadata immediately so the sidebar updates
        // while the reply types out.
        if (data.session_id) {
          setSessionId(data.session_id);
          setIsDraftSession(false);
          setHasPickedInitialSession(true);
        }
        if (data.session_token) setSessionToken(data.session_token);
        const incomingBorrower =
          (data.borrower_profile as GuestBorrowerProfile | null | undefined) ?? null;
        if (incomingBorrower) setExistingBorrowerProfile(incomingBorrower);
        if (data.profile || incomingBorrower) {
          setProfile((prev) =>
            mergeBorrowerSnapshotIntoProfile(
              data.profile ? { ...prev, ...(data.profile as PrequalProfile) } : prev,
              incomingBorrower,
            ),
          );
        }
        if (data.loan_match) setLoanMatch(data.loan_match);
        if (data.letter_data) setLetterData(data.letter_data);
        if (data.document_gaps?.length) setDocumentGaps(data.document_gaps);
        if (data.assigned_officer) setAssignedOfficer(data.assigned_officer);
        if (data.assigned_officer_profile) {
          setAssignedOfficerProfile(data.assigned_officer_profile as AssignedOfficerProfile);
        }
        if (data.borrower_id) setBorrowerId(data.borrower_id as string);

        const assistantText =
          typeof data.message === "string" && data.message.trim()
            ? data.message
            : "Sorry, I couldn't generate a response.";

        // Swap the waiting indicator for a live typing bubble.
        setLoading(false);
        setIsStreaming(true);
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        await streamWords(
          assistantText,
          (partial) => {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role !== "assistant") return prev;
              next[next.length - 1] = { ...last, content: partial };
              return next;
            });
          },
          () => streamCancelRef.current,
        );

        if (data.session_id) {
          if (historyEnabled) invalidateSessionQueries(data.session_id);
          queryClient.invalidateQueries({ queryKey: ["prequal-pipeline"] });
          logCrud("create", "agent", data.session_id, { agent: "prequal-agent" });
        }

        if (isGuestMode && data.session_id && data.session_token && contactName && contactEmail) {
          const stored: GuestSessionStored = {
            sessionId: data.session_id,
            sessionToken: data.session_token,
            name: contactName,
            email: contactEmail,
            ...(profile.borrower_phone ? { phone: profile.borrower_phone } : {}),
          };
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(stored));
        }
      } catch (err) {
        console.error("Prequal agent error:", err);
        const raw = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        const message = formatUserFacingAiError(raw);
        setError(message);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry, I encountered an error: ${message}` },
        ]);
      } finally {
        setLoading(false);
        setIsStreaming(false);
      }
    },
    [
      messages,
      loading,
      isStreaming,
      sessionId,
      sessionToken,
      profile,
      isGuestMode,
      guestReady,
      contact,
      contactName,
      contactEmail,
      historyEnabled,
      invalidateSessionQueries,
      queryClient,
    ],
  );

  const resetSession = useCallback(() => {
    streamCancelRef.current = true;
    setIsStreaming(false);
    setLoading(false);
    setMessages([INITIAL_MESSAGE]);
    setSessionId(null);
    setSessionToken(null);
    setIsDraftSession(true);
    setNeedsHydration(false);
    setProfile({});
    setLoanMatch(null);
    setLetterData(null);
    setDocumentGaps([]);
    setAssignedOfficer(null);
    setAssignedOfficerProfile(null);
    setBorrowerId(null);
    setExistingBorrowerProfile(null);
    setError(null);

    if (isGuestMode) {
      setGuestReady(false);
      setContactName(null);
      setContactEmail(null);
      localStorage.removeItem(GUEST_STORAGE_KEY);
    } else if (contact?.name || contact?.email) {
      // Keep signed-in identity on the scorecard for the new draft session.
      setProfile({
        borrower_name: contact.name?.trim() || undefined,
        borrower_email: contact.email?.trim() || undefined,
      });
    }
  }, [isGuestMode, contact]);

  // Cancel in-flight typewriter if the component unmounts.
  useEffect(() => {
    return () => {
      streamCancelRef.current = true;
    };
  }, []);

  return {
    messages,
    loading,
    isStreaming,
    sessionId,
    sessions: historyEnabled ? sessions : [],
    isLoadingHistory,
    profile,
    loanMatch,
    letterData,
    documentGaps,
    assignedOfficer,
    assignedOfficerProfile,
    borrowerId,
    existingBorrowerProfile,
    creatingBorrower,
    guestReady,
    isLoadingGuestSession,
    contactName: contactName ?? contact?.name ?? null,
    contactEmail: contactEmail ?? contact?.email ?? null,
    error,
    sendMessage,
    startGuestSession,
    lookupGuestSessions,
    resumeGuestByEmail,
    createBorrowerFromPrequal,
    resetSession,
    loadSession,
  };
}
