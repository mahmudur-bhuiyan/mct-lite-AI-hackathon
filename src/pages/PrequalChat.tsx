import { useState, useRef, useEffect } from "react";
import { useChatScrollToBottom } from "@/hooks/useChatScrollToBottom";
import { format } from "date-fns";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  usePrequalAgent,
  type PrequalAgentMode,
  type PrequalContact,
} from "@/hooks/usePrequalAgent";
import type { PrequalSession } from "@/hooks/usePrequalSessions";
import {
  formatSessionTitle,
  getOfficerProfile,
} from "../../supabase/functions/_shared/prequal-tools";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { validatePhone } from "@/lib/validation";
import {
  Send,
  Download,
  Bot,
  User,
  TrendingUp,
  FileText,
  UserCheck,
  LogIn,
  History,
  MessageSquarePlus,
  Loader2,
  Mail,
  Phone,
  BadgeCheck,
} from "lucide-react";
import jsPDF from "jspdf";
import logoUrl from "@/assets/mortgageai-logo.svg";

function formatSessionTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return format(d, "MMM d");
}

function sessionLabel(session: PrequalSession): string {
  const title = formatSessionTitle(session.title ?? "");
  if (title) return title;
  const date = format(new Date(session.updated_at), "MMM d, yyyy");
  if (session.status === "completed") return `Completed · ${date}`;
  if (session.status === "abandoned") return `Abandoned · ${date}`;
  return `Pre-qual · ${date}`;
}

interface PrequalChatProps {
  mode?: PrequalAgentMode;
}

export default function PrequalChat({ mode = "authenticated" }: PrequalChatProps) {
  const { profile: authProfile, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Keep reading from the URL (not a one-shot state) so React Strict Mode remounts
  // still open a blank draft instead of restoring the latest history session.
  const startFresh = searchParams.get("new") === "1";

  const contact: PrequalContact | null =
    mode === "authenticated" && user
      ? {
          name: authProfile?.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "",
          email: authProfile?.email ?? user.email ?? "",
        }
      : null;

  const {
    messages,
    loading,
    isStreaming,
    sessionId,
    sessions,
    isLoadingHistory,
    profile,
    loanMatch,
    letterData,
    documentGaps,
    assignedOfficer,
    guestReady,
    contactEmail,
    contactName,
    sendMessage,
    startGuestSession,
    resetSession,
    loadSession,
  } = usePrequalAgent({ mode, contact, startFresh });

  // Drop ?new=1 once a real session exists or the user opens history.
  useEffect(() => {
    if (!startFresh || !sessionId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [startFresh, sessionId, searchParams, setSearchParams]);

  const [input, setInput] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [intakeError, setIntakeError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = loading || isStreaming;
  // Include last-message length so auto-scroll follows word-by-word reveal.
  const scrollKey =
    messages.length + (messages[messages.length - 1]?.content.length ?? 0);
  const { scrollRootRef, bottomRef } = useChatScrollToBottom(scrollKey, busy);

  const isPublic = mode === "guest";
  const showIntake = isPublic && !guestReady;

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(text);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGuestStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntakeError("");
    const phone = guestPhone.trim();
    if (phone && !validatePhone(phone)) {
      setIntakeError("Please enter a valid phone number");
      return;
    }
    try {
      await startGuestSession({
        name: guestName,
        email: guestEmail,
        ...(phone ? { phone } : {}),
      });
    } catch (err) {
      setIntakeError(err instanceof Error ? err.message : "Could not start chat");
    }
  };

  const loginHref = (() => {
    const params = new URLSearchParams();
    const email = contactEmail ?? guestEmail;
    const name = contactName ?? guestName;
    if (email) params.set("email", email);
    if (name) params.set("name", name);
    const qs = params.toString();
    return qs ? `/login?${qs}` : "/login";
  })();

  const downloadLetter = () => {
    if (!letterData) return;

    const doc = new jsPDF();
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const expiry = new Date(Date.now() + 90 * 86400000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    doc.setFillColor(15, 30, 70);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("MCT MORTGAGE", 20, 14);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("AI-Powered Pre-Qualification", 20, 22);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.text(today, 20, 45);
    doc.setFont("helvetica", "bold");
    doc.text(`Re: Mortgage Pre-Qualification for ${letterData.borrower_name}`, 20, 55);
    doc.setFont("helvetica", "normal");
    doc.text(`Dear ${letterData.borrower_name},`, 20, 68);

    const intro = `MCT Mortgage is pleased to inform you that based on the financial information you have provided, you have been pre-qualified for a ${letterData.loan_product} mortgage loan.`;
    const introLines = doc.splitTextToSize(intro, 170);
    doc.text(introLines, 20, 80);

    doc.setFillColor(240, 245, 255);
    doc.rect(20, 100, 170, 35, "F");
    doc.setFontSize(9);
    doc.setTextColor(30, 80, 180);
    doc.setFont("helvetica", "bold");
    doc.text("PRE-QUALIFICATION AMOUNT", 26, 111);
    doc.setFontSize(24);
    doc.setTextColor(15, 30, 70);
    doc.text(`$${letterData.prequal_amount.toLocaleString()}`, 26, 128);

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    const terms =
      "This pre-qualification is based on the information you provided and is subject to verification of income, assets, employment, and credit. It is not a commitment to lend.";
    const termsLines = doc.splitTextToSize(terms, 170);
    doc.text(termsLines, 20, 148);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 140, 70);
    doc.text(`Valid through: ${expiry}`, 20, 172);

    doc.setFillColor(245, 247, 250);
    doc.rect(0, 280, 210, 17, "F");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text("MCT Mortgage | EQUAL HOUSING LENDER | This is not a commitment to lend.", 20, 290);

    doc.save(`prequal-${letterData.borrower_name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    toast.success("Pre-qualification letter downloaded!");
  };

  const chatHeight = isPublic
    ? "h-screen overflow-hidden"
    : "h-[calc(100vh-4rem)] w-full -m-6 -mr-0 lg:-m-8 lg:-mr-0 overflow-hidden";

  return (
    <div className={`flex flex-col ${chatHeight}`}>
      {isPublic && (
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 bg-background">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="MCT Mortgage" className="h-7 w-auto" />
            <div>
              <p className="text-sm font-semibold">Pre-Qualification with Alex</p>
              <p className="text-xs text-muted-foreground">Free · No account required to start</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to={loginHref}>Sign in</Link>
          </Button>
        </header>
      )}

      <div className={`flex flex-1 min-h-0 gap-0 ${showIntake ? "items-center justify-center p-4" : ""}`}>
        {showIntake ? (
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center space-y-1">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                  A
                </div>
                <h1 className="text-lg font-semibold">Chat with Alex</h1>
                <p className="text-sm text-muted-foreground">
                  Tell us who you are so we can add you to our loan officer pipeline and follow up.
                </p>
              </div>
              <form onSubmit={handleGuestStart} className="space-y-4">
                {intakeError && (
                  <p className="text-sm text-destructive rounded-md border border-destructive/20 bg-destructive/5 p-2">
                    {intakeError}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="guest-name">
                    Full name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="guest-name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="guest-email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guest-phone">Phone number</Label>
                  <Input
                    id="guest-phone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    disabled={loading}
                    autoComplete="tel"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Starting chat…" : "Start pre-qualification"}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        ) : (
          <>
            {!isPublic && user && (
              <aside className="w-64 flex-shrink-0 border-r bg-muted/20 flex flex-col min-h-0 hidden lg:flex">
                <div className="px-4 py-3 border-b">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Chat History
                  </p>
                </div>
                <div className="px-3 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={resetSession}
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5 mr-2" />
                    New Session
                  </Button>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="px-2 pb-3 space-y-0.5">
                    {isLoadingHistory && sessions.length === 0 ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Loading history…
                      </div>
                    ) : sessions.length === 0 ? (
                      <p className="px-2 py-6 text-xs text-muted-foreground text-center">
                        No past chats yet. Start a conversation with Alex.
                      </p>
                    ) : (
                      sessions.map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          onClick={() => loadSession(session.id)}
                          className={`w-full flex items-start gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${
                            sessionId === session.id
                              ? "bg-primary/10 border-l-2 border-l-primary"
                              : "hover:bg-muted/60 border-l-2 border-l-transparent"
                          }`}
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/80 mt-0.5">
                            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs leading-snug line-clamp-2">
                              {sessionLabel(session)}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {formatSessionTime(session.updated_at)}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </aside>
            )}

            <div className="flex flex-col flex-1 min-w-0 min-h-0 border-r">
              <div className="flex items-center gap-3 px-6 py-4 border-b bg-background shrink-0">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  A
                </div>
                <div>
                  <p className="text-sm font-semibold">Alex</p>
                  <p className="text-xs text-muted-foreground">
                    MCT Mortgage Pre-Qualification Specialist
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-muted-foreground">Online</span>
                  {!isPublic && (
                    <Button variant="ghost" size="sm" onClick={resetSession} className="text-xs lg:hidden">
                      New Session
                    </Button>
                  )}
                </div>
              </div>

              {!isPublic && isLoadingHistory ? (
                <div className="flex-1 min-h-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Restoring your conversation…
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex flex-col w-full min-w-0">
                  <ScrollArea ref={scrollRootRef} className="flex-1 min-h-0 w-full min-w-0">
                    <div className="min-h-full flex flex-col justify-end py-6 px-4">
                      <div className="space-y-4 max-w-2xl mx-auto w-full">
                        {messages.map((msg, i) => {
                          const isLiveReply =
                            isStreaming &&
                            i === messages.length - 1 &&
                            msg.role === "assistant";
                          const html =
                            msg.content
                              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                              .replace(/\n/g, "<br/>") +
                            (isLiveReply
                              ? '<span class="inline-block w-1.5 h-4 ml-0.5 align-middle bg-foreground/70 animate-pulse"></span>'
                              : "");
                          return (
                            <div
                              key={i}
                              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              {msg.role === "assistant" && (
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                                  <Bot className="w-4 h-4 text-primary-foreground" />
                                </div>
                              )}
                              {(msg.content || isLiveReply) && (
                                <div
                                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                    msg.role === "user"
                                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                                      : "bg-muted rounded-tl-sm"
                                  }`}
                                  dangerouslySetInnerHTML={{ __html: html }}
                                />
                              )}
                              {msg.role === "user" && (
                                <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center flex-shrink-0 mt-1">
                                  <User className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {loading && !isStreaming && (
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                              <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                  <div
                                    key={i}
                                    className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"
                                    style={{ animationDelay: `${i * 0.15}s` }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={bottomRef} />
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              )}

              <div className="border-t bg-background p-4 shrink-0">
                <div className="max-w-2xl mx-auto flex gap-3 items-end">
                  <Textarea
                    ref={inputRef}
                    placeholder="Type your message… (Enter to send)"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    className="resize-none min-h-[44px] max-h-[120px]"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim() || busy}
                    className="h-11 w-11 flex-shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Your information is secure and used only for pre-qualification
                </p>
              </div>
            </div>

            <ScorecardSidebar
              profile={profile}
              loanMatch={loanMatch}
              documentGaps={documentGaps}
              letterData={letterData}
              assignedOfficer={assignedOfficer}
              downloadLetter={downloadLetter}
              showAccountCta={isPublic || !user}
              loginHref={loginHref}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ScorecardSidebar({
  profile,
  loanMatch,
  documentGaps,
  letterData,
  assignedOfficer,
  downloadLetter,
  showAccountCta,
  loginHref,
}: {
  profile: ReturnType<typeof usePrequalAgent>["profile"];
  loanMatch: ReturnType<typeof usePrequalAgent>["loanMatch"];
  documentGaps: string[];
  letterData: ReturnType<typeof usePrequalAgent>["letterData"];
  assignedOfficer: string | null;
  downloadLetter: () => void;
  showAccountCta: boolean;
  loginHref: string;
}) {
  return (
    <div className="w-80 flex-shrink-0 bg-background min-h-0 h-full flex flex-col hidden md:flex">
      <div className="shrink-0 border-b px-4 py-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary shrink-0" />
          Live Eligibility Scorecard
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Updates as we chat</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-4 space-y-5">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Profile
          </p>
          <div className="space-y-2 text-xs">
            <MetricRow label="Name" value={profile.borrower_name ?? "—"} />
            <MetricRow label="Email" value={profile.borrower_email ?? "—"} />
            <MetricRow label="Phone" value={profile.borrower_phone ?? "—"} />
            <MetricRow
              label="Annual Income"
              value={profile.annual_income ? `$${profile.annual_income.toLocaleString()}` : "—"}
            />
            <MetricRow
              label="Monthly Debts"
              value={profile.monthly_debts ? `$${profile.monthly_debts.toLocaleString()}` : "—"}
            />
            <MetricRow label="Credit Tier" value={profile.credit_tier ?? "—"} capitalize />
            <MetricRow
              label="Employment"
              value={profile.employment_type?.replace("_", "-") ?? "—"}
              capitalize
            />
            <MetricRow
              label="Target Price"
              value={profile.target_price ? `$${profile.target_price.toLocaleString()}` : "—"}
            />
            <MetricRow
              label="Down Payment"
              value={profile.down_payment ? `$${profile.down_payment.toLocaleString()}` : "—"}
            />
          </div>
        </div>

        {(profile.front_dti || profile.back_dti) && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Debt-to-Income
              </p>
              <div className="space-y-3">
                <DTIBar label="Front-end DTI" value={profile.front_dti} warningAt={28} dangerAt={36} />
                <DTIBar label="Back-end DTI" value={profile.back_dti} warningAt={36} dangerAt={43} />
                <p className="text-xs text-muted-foreground">Fannie Mae max: 43% back-end</p>
              </div>
            </div>
          </>
        )}

        {loanMatch && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Loan Match
              </p>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <Badge variant="outline" className="mb-2 text-primary border-primary">
                    {loanMatch.product_type}
                  </Badge>
                  <p className="text-2xl font-bold text-primary">
                    ${loanMatch.prequal_amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">Maximum pre-qualification</p>
                  <div className="space-y-1 text-xs">
                    <MetricRow label="Est. Rate" value={`${loanMatch.estimated_rate}%`} />
                    <MetricRow
                      label="Monthly"
                      value={`$${loanMatch.monthly_payment.toLocaleString()}/mo`}
                    />
                    <MetricRow
                      label="Loan Amount"
                      value={`$${loanMatch.loan_amount.toLocaleString()}`}
                    />
                    <MetricRow label="LTV" value={`${loanMatch.ltv}%`} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {documentGaps.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Documents Needed
              </p>
              <ul className="space-y-1.5">
                {documentGaps.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-amber-500 mt-0.5 flex-shrink-0">○</span>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {letterData && (
          <>
            <Separator />
            <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
              <CardContent className="p-4 text-center">
                <p className="text-2xl mb-1">🎉</p>
                <p className="text-sm font-bold text-green-700 dark:text-green-400">
                  You&apos;re Pre-Qualified!
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1 mb-3">
                  Your official letter is ready
                </p>
                <Button onClick={downloadLetter} size="sm" className="w-full bg-green-600 hover:bg-green-700">
                  <Download className="w-3 h-3 mr-2" />
                  Download Letter
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {assignedOfficer && (
          <>
            <Separator />
            <LoanOfficerCard name={assignedOfficer} />
          </>
        )}

        {showAccountCta && (
          <>
            <Separator />
            <Card className="border-primary/20">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold">Save your progress</p>
                <p className="text-xs text-muted-foreground">
                  Create an account or sign in so your loan officer can follow up and you can track
                  your pre-qualification.
                </p>
                <Button asChild size="sm" className="w-full">
                  <Link to={loginHref}>
                    <LogIn className="w-3 h-3 mr-2" />
                    Sign in / Create account
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function LoanOfficerCard({ name }: { name: string }) {
  const officer = getOfficerProfile(name);
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const title = officer?.title ?? "MCT Mortgage Specialist";
  const phoneHref = officer?.phone.replace(/[^\d+]/g, "");

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
        <UserCheck className="w-3 h-3" /> Your Loan Officer
      </p>
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">{name}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
            {officer?.specialty && (
              <p className="text-xs text-muted-foreground mt-0.5">{officer.specialty}</p>
            )}
          </div>
        </div>

        {officer && (
          <div className="space-y-1.5 text-xs">
            <a
              href={`tel:${phoneHref}`}
              className="flex items-center gap-2 text-foreground hover:text-primary transition-colors"
            >
              <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
              <span>{officer.phone}</span>
            </a>
            <a
              href={`mailto:${officer.email}`}
              className="flex items-center gap-2 text-foreground hover:text-primary transition-colors min-w-0"
            >
              <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="truncate">{officer.email}</span>
            </a>
            <div className="flex items-center gap-2 text-muted-foreground">
              <BadgeCheck className="w-3 h-3 shrink-0" />
              <span>NMLS #{officer.nmls_id}</span>
            </div>
          </div>
        )}

        <p className="text-xs text-primary font-medium">Will contact you within 24h</p>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  const isEmpty = value === "—";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 items-center w-full">
      <span className="text-muted-foreground leading-snug">{label}</span>
      <span
        className={`text-right leading-snug tabular-nums shrink-0 max-w-[9rem] truncate ${
          isEmpty ? "text-muted-foreground/50 font-normal" : "font-semibold"
        } ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function DTIBar({
  label,
  value,
  warningAt,
  dangerAt,
}: {
  label: string;
  value?: number;
  warningAt: number;
  dangerAt: number;
}) {
  const pct = value ?? 0;
  const status = pct === 0 ? "" : pct <= warningAt ? "✅" : pct <= dangerAt ? "⚠️" : "❌";
  const colorClass =
    pct <= warningAt ? "bg-green-500" : pct <= dangerAt ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{pct > 0 ? `${status} ${pct.toFixed(1)}%` : "—"}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
