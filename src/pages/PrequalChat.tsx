import { useState, useRef, useEffect } from "react";
import { usePrequalAgent } from "@/hooks/usePrequalAgent";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, Download, Bot, User, TrendingUp, FileText, UserCheck } from "lucide-react";
import jsPDF from "jspdf";

export default function PrequalChat() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
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
  } = usePrequalAgent();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

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

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0">
      <div className="flex flex-col flex-1 min-w-0 border-r">
        <div className="flex items-center gap-3 px-6 py-4 border-b bg-background">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            A
          </div>
          <div>
            <p className="text-sm font-semibold">Alex</p>
            <p className="text-xs text-muted-foreground">MCT Mortgage Pre-Qualification Specialist</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">Online</span>
            <Button variant="ghost" size="sm" onClick={resetSession} className="text-xs">
              New Session
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4 py-6">
          <div className="space-y-4 max-w-2xl mx-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\n/g, "<br/>"),
                  }}
                />
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
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
            {error && <p className="text-center text-xs text-destructive">{error}</p>}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t bg-background p-4">
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
              disabled={!input.trim() || loading}
              className="h-11 w-11 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            🔒 Your information is secure and used only for pre-qualification
          </p>
        </div>
      </div>

      <div className="w-80 flex-shrink-0 bg-background overflow-y-auto">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Live Eligibility Scorecard
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Updates as we chat</p>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Profile
            </p>
            <div className="space-y-2 text-xs">
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
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Your Loan Officer
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm flex-shrink-0">
                    {assignedOfficer
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{assignedOfficer}</p>
                    <p className="text-xs text-muted-foreground">MCT Mortgage Specialist</p>
                    <p className="text-xs text-primary mt-0.5">Will contact you within 24h</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
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
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${capitalize ? "capitalize" : ""}`}>{value}</span>
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
