import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logCrud } from "@/lib/activity-logger";

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

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hi! I'm Alex, your mortgage pre-qualification specialist 👋\n\nI can get you pre-qualified for a home loan in just a few minutes — no paperwork, no forms, just a quick conversation.\n\n**What type of home are you looking to buy, and do you have a target price range in mind?**",
};

function toApiMessages(messages: Message[]): Array<{ role: string; content: string }> {
  const firstUserIdx = messages.findIndex((m) => m.role === "user");
  if (firstUserIdx < 0) return [];
  return messages.slice(firstUserIdx).map((m) => ({ role: m.role, content: m.content }));
}

export function usePrequalAgent() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profile, setProfile] = useState<PrequalProfile>({});
  const [loanMatch, setLoanMatch] = useState<LoanMatch | null>(null);
  const [letterData, setLetterData] = useState<LetterData | null>(null);
  const [documentGaps, setDocumentGaps] = useState<string[]>([]);
  const [assignedOfficer, setAssignedOfficer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || loading) return;

      const userMsg: Message = { role: "user", content: userText };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setLoading(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const { data, error: fnError } = await supabase.functions.invoke("prequal-agent", {
          body: {
            messages: toApiMessages(newMessages),
            session_id: sessionId,
            profile,
            user_message: userText,
          },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
        if (data.session_id) setSessionId(data.session_id);
        if (data.profile) setProfile(data.profile);
        if (data.loan_match) setLoanMatch(data.loan_match);
        if (data.letter_data) setLetterData(data.letter_data);
        if (data.document_gaps?.length) setDocumentGaps(data.document_gaps);
        if (data.assigned_officer) setAssignedOfficer(data.assigned_officer);

        if (data.session_id) {
          logCrud("create", "agent", data.session_id, { agent: "prequal-agent" });
        }
      } catch (err) {
        console.error("Prequal agent error:", err);
        setError("Something went wrong. Please try again.");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, sessionId, profile],
  );

  const resetSession = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setSessionId(null);
    setProfile({});
    setLoanMatch(null);
    setLetterData(null);
    setDocumentGaps([]);
    setAssignedOfficer(null);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    profile,
    loanMatch,
    letterData,
    documentGaps,
    assignedOfficer,
    error,
    sendMessage,
    resetSession,
  };
}
