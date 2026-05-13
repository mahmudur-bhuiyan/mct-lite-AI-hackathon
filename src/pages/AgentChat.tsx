import { useState, useEffect, useCallback } from "react";
import { useChatScrollToBottom } from "@/hooks/useChatScrollToBottom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAdminSidebar } from "@/contexts/AdminSidebarContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { getInitials } from "@/lib/utils";
import { format } from "date-fns";
import { useAIAgent } from "@/hooks/useAIAgents";
import { isAgentAllowedForUser } from "@/lib/agentRoles";
import {
  type LlmProvider,
  getDefaultModelForProvider,
  resolveLlmProviderFromConfig,
} from "@/lib/aiAgentProviders";
import { useIntegrationSetting } from "@/hooks/useIntegrationSettings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Bot,
  Send,
  Loader2,
  AlertCircle,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
  PanelLeftClose,
  PanelRight,
  Settings,
  ChevronDown,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatThread {
  id: string;
  title: string | null;
  last_message_at: string;
}

const DEFAULT_WELCOME =
  "Send a message to start the conversation. I'll use the agent's instructions to help you.";

function formatThreadTime(dateStr: string): string {
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

async function extractEdgeErrorMessage(err: unknown): Promise<string> {
  const fallback =
    err instanceof Error && err.message
      ? err.message
      : "Request failed.";

  const maybe = err as {
    context?: { json?: () => Promise<unknown>; text?: () => Promise<string> };
  };

  try {
    if (maybe?.context?.json) {
      const body = (await maybe.context.json()) as { error?: string; message?: string };
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    }
  } catch {
    // ignore parse errors
  }

  try {
    if (maybe?.context?.text) {
      const text = await maybe.context.text();
      if (text?.trim()) return text.trim();
    }
  } catch {
    // ignore parse errors
  }

  return fallback;
}

function shouldAutoGenerateTitle(currentTitle?: string | null): boolean {
  const normalized = currentTitle?.trim();
  return !normalized || normalized === "New chat";
}

function getConversationIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const maybeId = (metadata as Record<string, unknown>).conversation_id;
  if (typeof maybeId !== "string") return null;
  const normalized = maybeId.trim();
  return normalized.length > 0 ? normalized : null;
}

interface AgentChatProps {
  fullScreen?: boolean;
}

export default function AgentChat({ fullScreen = false }: AgentChatProps) {
  const { agentId } = useParams<{ agentId: string }>();
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith("/admin");
  // Optional loan context passed via navigate(path, { state: { loanContext: {...} } })
  const loanContext = (location.state as { loanContext?: Record<string, unknown> } | null)
    ?.loanContext ?? null;
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const appSidebar = useAppSidebar();
  const adminSidebar = useAdminSidebar();
  const { data: agent, isLoading: agentLoading } = useAIAgent(agentId ?? "");
  const activeProvider: LlmProvider = resolveLlmProviderFromConfig(agent?.provider_config);
  const { data: activeIntegration } = useIntegrationSetting(
    isAdmin && activeProvider !== "lovable" ? activeProvider : ""
  );

  // Collapse the correct sidebar by default: admin sidebar when in admin panel, app sidebar when under /ai
  useEffect(() => {
    if (fullScreen) return;
    if (isAdminPath && adminSidebar?.setCollapsed) {
      adminSidebar.setCollapsed(true);
    } else if (!isAdminPath && appSidebar?.setCollapsed) {
      appSidebar.setCollapsed(true);
    }
  }, [fullScreen, isAdminPath, adminSidebar?.setCollapsed, appSidebar?.setCollapsed]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  // Tracks the relational agent_conversations.id for the current chat session
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem("agent-chat-sidebar-open");
      return stored !== "false";
    } catch {
      return true;
    }
  });

  const {
    scrollRootRef: messagesScrollRootRef,
    bottomRef,
    isAtBottom,
    scrollToBottom,
    scrollToBottomAfterRender,
  } = useChatScrollToBottom(
    messages.length,
    isLoading
  );

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("agent-chat-sidebar-open", String(next));
      } catch {}
      return next;
    });
  }, []);

  // Lovable uses LOVABLE_API_KEY on the edge — no integration_settings row required.
  const isProviderReady =
    !isAdmin ||
    activeProvider === "lovable" ||
    (!!activeIntegration?.api_key && activeIntegration.is_active !== false);
  const providerLabel =
    activeProvider === "lovable"
      ? "Lovable AI"
      : activeProvider === "google"
        ? "Google AI"
        : activeProvider === "anthropic"
          ? "Anthropic"
          : activeProvider === "perplexity"
            ? "Perplexity"
            : "OpenAI";

  // Fetch threads list and load most recent thread for this user + agent
  const fetchThreads = useCallback(async () => {
    if (!user?.id || !agent?.slug) return;
    try {
      const { data, error } = await supabase
        .from("ai_chat_threads")
        .select("id, title, last_message_at")
        .eq("user_id", user.id)
        .eq("agent_slug", agent.slug)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      setThreads((data ?? []) as ChatThread[]);
    } catch (e) {
      console.error("Fetch threads:", e);
    }
  }, [user?.id, agent?.slug]);

  useEffect(() => {
    if (!user?.id || !agent?.slug) return;
    fetchThreads();
    async function loadLast() {
      try {
        const { data, error } = await supabase
          .from("ai_chat_threads")
          .select("id, messages, metadata")
          .eq("user_id", user.id)
          .eq("agent_slug", agent.slug)
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data?.messages && Array.isArray(data.messages)) {
          const restored: Message[] = data.messages.map((m: any, i: number) => ({
            id: String(i + 1),
            role: m.role === "user" ? "user" : "assistant",
            content: String(m.content ?? ""),
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          }));
          if (restored.length > 0) {
            setMessages(restored);
            setThreadId(data.id);
            setConversationId(getConversationIdFromMetadata(data.metadata));
          }
        }
      } catch (e) {
        console.error("Load thread:", e);
      }
    }
    loadLast();
  }, [user?.id, agent?.slug, fetchThreads]);

  const generateAndUpdateTitle = useCallback(
    async (tid: string, allMessages: Message[], currentTitle?: string | null) => {
      if (!shouldAutoGenerateTitle(currentTitle)) return;
      const firstUser = allMessages.find((m) => m.role === "user")?.content?.slice(0, 200) ?? "";
      const firstAssistant = allMessages.find((m) => m.role === "assistant")?.content?.slice(0, 200) ?? "";
      if (!firstUser || !firstAssistant) return;
      try {
        const { data } = await supabase.functions.invoke("ai-chat-assistant", {
          body: {
            messages: [
              {
                role: "system",
                content:
                  "Generate a short conversation title in 3-6 words. Reply with only the title, no quotes or punctuation.",
              },
              {
                role: "user",
                content: `User: ${firstUser}\nAssistant: ${firstAssistant}`,
              },
            ],
            model: "gpt-4o-mini",
            temperature: 0.3,
          },
        });
        const raw = data?.choices?.[0]?.message?.content ?? data?.response ?? "";
        const title = String(raw).trim().slice(0, 80) || "New chat";
        await supabase.from("ai_chat_threads").update({ title }).eq("id", tid);
        fetchThreads();
      } catch {
        // Non-blocking; keep "New chat" if generation fails
      }
    },
    [fetchThreads]
  );

  const persistThread = useCallback(
    async (
      allMessages: Message[],
      title?: string | null,
      linkedConversationId?: string | null
    ) => {
      if (!user || !agent) return;
      const effectiveConversationId = linkedConversationId ?? conversationId;
      const payload: Record<string, unknown> = {
        user_id: user.id,
        agent_slug: agent.slug,
        messages: allMessages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        })),
        last_message_at: new Date().toISOString(),
      };
      if (effectiveConversationId) {
        payload.metadata = { conversation_id: effectiveConversationId };
      }
      if (title !== undefined) payload.title = title;
      else if (!threadId) payload.title = "New chat";
      try {
        let resolvedId: string | null = null;
        if (threadId) {
          await supabase.from("ai_chat_threads").update(payload).eq("id", threadId);
          resolvedId = threadId;
          fetchThreads();
        } else {
          const { data } = await supabase
            .from("ai_chat_threads")
            .insert(payload)
            .select("id")
            .single();
          if (data?.id) {
            setThreadId(data.id);
            fetchThreads();
            resolvedId = data.id;
          }
        }
        if (resolvedId && allMessages.length >= 2 && title === undefined) {
          const currentTitle =
            resolvedId === threadId
              ? threads.find((t) => t.id === resolvedId)?.title
              : "New chat";
          generateAndUpdateTitle(resolvedId, allMessages, currentTitle);
        }
      } catch (e) {
        console.error("Persist thread:", e);
      }
    },
    [user, agent, threadId, fetchThreads, generateAndUpdateTitle, threads, conversationId]
  );

  const loadThread = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from("ai_chat_threads")
        .select("id, messages, metadata")
        .eq("id", id)
        .single();
      if (error || !data) throw error ?? new Error("Thread not found");
      const restored: Message[] = Array.isArray(data.messages)
        ? data.messages.map((m: any, i: number) => ({
            id: String(i + 1),
            role: m.role === "user" ? "user" : "assistant",
            content: String(m.content ?? ""),
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          }))
        : [];
      setMessages(restored);
      setThreadId(data.id);
      setConversationId(getConversationIdFromMetadata(data.metadata));
    } catch (e) {
      console.error("Load thread:", e);
      toast.error("Failed to load conversation");
    }
  }, []);

  const handleNewChat = () => {
    setMessages([]);
    setThreadId(null);
    setConversationId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user || !agent) return;
    if (!isProviderReady) {
      toast.error(
        `${providerLabel} integration is not configured. Add a valid API key in Admin → Integrations.`
      );
      return;
    }

    const userMsg: Message = {
      id: String(Date.now()),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottomAfterRender();
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history for context (user+assistant turns only)
      // System prompt is loaded server-side in run-ai-agent to prevent client injection
      const conversationHistory = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const body: Record<string, unknown> = {
        agent_slug: agent.slug,
        agent_id: agent.id,
        input: userMsg.content,
        conversation_history: conversationHistory,
        conversation_id: conversationId,
      };
      // Inject loan context so agent system prompt receives it under "Context:"
      if (loanContext) body.context = loanContext;

      const { data, error } = await supabase.functions.invoke("run-ai-agent", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Track the relational conversation_id for subsequent turns
      const responseConversationId =
        typeof data?.conversation_id === "string" ? (data.conversation_id as string) : null;
      if (responseConversationId && !conversationId) {
        setConversationId(responseConversationId);
      }

      const assistantContent = data?.output ?? "I couldn't generate a response.";
      const assistantMsg: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: assistantContent,
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const next = [...prev, assistantMsg];
        persistThread(next, undefined, responseConversationId ?? conversationId);
        return next;
      });
    } catch (err: unknown) {
      const message = await extractEdgeErrorMessage(err);
      console.error("Agent chat error:", err);
      toast.error(message || "Failed to get response.");
      const errMsg: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: `Error: ${message || "Request failed."}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  if (agentLoading || !agentId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">Agent not found.</p>
        <Button variant="outline" asChild>
          <Link to="/admin/agents">Back to Agents</Link>
        </Button>
      </div>
    );
  }

  if (!isAgentAllowedForUser(agent.slug, profile, agent.required_role ?? null)) {
    const back = location.pathname.startsWith("/admin") ? "/admin/agents" : "/agents";
    return (
      <div className="space-y-4 p-6">
        <p className="text-muted-foreground">You do not have access to this agent.</p>
        <Button variant="outline" asChild>
          <Link to={back}>Back to Agents</Link>
        </Button>
      </div>
    );
  }

  const backHref = window.location.pathname.startsWith("/admin") ? "/admin/agents" : "/ai/agents";

  const displayModel =
    (() => {
      const cfg = agent.provider_config as { model?: string } | null;
      if (typeof cfg?.model === "string" && cfg.model.trim()) return cfg.model;
      return getDefaultModelForProvider(activeProvider);
    })();

  return (
    <div
      className={
        fullScreen
          ? "flex h-[calc(100vh-4rem)] w-full rounded-none border-0 bg-card overflow-hidden"
          : "flex h-[calc(100vh-4rem)] w-full -m-6 -mr-0 lg:-m-8 lg:-mr-0 rounded-none border-0 bg-card overflow-hidden"
      }
    >
      {/* Left sidebar — wider so description and chats have room */}
      <aside
        className={`flex flex-col shrink-0 border-r bg-muted/20 transition-[width] duration-200 ease-in-out overflow-hidden ${
          sidebarOpen ? "w-[380px]" : "w-14"
        }`}
      >
        {sidebarOpen ? (
          <>
            {/* Compact header: back + collapse */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b min-h-12">
              <Button variant="ghost" size="sm" className="shrink-0 -ml-1" asChild>
                <Link to={backHref}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggleSidebar} aria-label="Collapse sidebar">
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            {/* Agent + New chat in compact block */}
            <div className="px-3 py-2.5 border-b">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{displayModel}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
                  aria-label="Edit agent config"
                  asChild
                >
                  <Link to={`${backHref}?edit=${agent.id}`}>
                    <Settings className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Link>
                </Button>
              </div>
              {agent.description && (
                <div className="mt-2 max-h-28 overflow-y-auto">
                  <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap" title={agent.description}>
                    {agent.description}
                  </p>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full mt-2 h-8 text-xs" onClick={handleNewChat}>
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                New chat
              </Button>
            </div>
            {/* Your chats — scrollable list */}
            <div className="flex-1 flex flex-col min-h-0">
              <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Your chats</p>
              <ScrollArea className="flex-1 min-h-[180px]">
                <div className="pr-2 pb-3 space-y-0.5 px-1">
              {threads.map((t) => (
                <div
                  key={t.id}
                  className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 text-left cursor-pointer transition-colors ${
                    threadId === t.id
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-muted/60 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => loadThread(t.id)}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 mt-0.5">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium text-sm leading-snug line-clamp-2 break-words"
                      title={t.title?.trim() || "New chat"}
                    >
                      {t.title?.trim() || "New chat"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatThreadTime(t.last_message_at)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100 rounded-full mt-0.5"
                        aria-label="Rename or delete chat"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          setRenameThreadId(t.id);
                          setRenameTitle(t.title?.trim() || "New chat");
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onSelect={(e) => {
                          e.preventDefault();
                          setDeleteThreadId(t.id);
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </ScrollArea>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center pt-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={toggleSidebar}
              aria-label="Expand sidebar to see chats"
            >
              <PanelRight className="h-5 w-5" />
            </Button>
          </div>
        )}
      </aside>

      {/* Main chat area — content-first, full height */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        {/* Slim top bar: left | center title | right */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 h-12">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -ml-1" onClick={toggleSidebar} aria-label="Expand sidebar">
              <PanelRight className="h-4 w-4" />
            </Button>
          )}
          <h1 className="font-medium text-sm truncate flex-1 min-w-0 text-center mx-2">
            {threadId ? (threads.find((t) => t.id === threadId)?.title?.trim() || "New chat") : "New chat"}
          </h1>
          <span className="text-xs text-muted-foreground shrink-0">{displayModel}</span>
        </div>

        {!isProviderReady && (
          <div className="mx-4 mt-4 flex items-center gap-3 rounded-lg border border-amber-400 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>
              {providerLabel} integration is not configured. Add and enable an API key in Admin → Integrations to chat.
            </p>
          </div>
        )}

        {loanContext && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 dark:bg-blue-900/10 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
            <Bot className="h-3.5 w-3.5 shrink-0" />
            <span>
              Loan context active
              {typeof loanContext.loan_number === "string" ? ` — ${loanContext.loan_number}` : ""}
              {typeof loanContext.borrower_name === "string" ? ` · ${loanContext.borrower_name}` : ""}
            </span>
          </div>
        )}

        {/* Messages — fills space; content pins to bottom */}
        <div className="flex-1 min-h-0 flex flex-col w-full min-w-0">
          <ScrollArea
            ref={messagesScrollRootRef}
            className="flex-1 min-h-0 w-full min-w-0"
          >
            <div className="min-h-full flex flex-col justify-end py-4 px-4">
              <div className="max-w-3xl mx-auto w-full space-y-5 pt-4">
                {messages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
                      <MessageSquare className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-medium text-base">Chat with {agent.name}</h3>
                    <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
                      {agent.description || DEFAULT_WELCOME}
                    </p>
                    {agent.system_prompt && (
                      <p className="text-xs text-muted-foreground mt-3 italic max-w-lg mx-auto">
                        {agent.system_prompt.slice(0, 120)}…
                      </p>
                    )}
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback>
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ node, ...props }) => (
                            <p className="mb-2 last:mb-0" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="list-disc ml-4 mb-2" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="list-decimal ml-4 mb-2" {...props} />
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      <p className="text-xs opacity-70 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback>{getInitials(profile?.full_name || "U")}</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-2xl bg-muted px-4 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>
          </ScrollArea>

          {!isAtBottom && (messages.length > 0 || isLoading) && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border bg-background shadow-md text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-opacity duration-200"
              aria-label="Scroll to latest message"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {/* Input — wide, centered, with disclaimer */}
          <div className="shrink-0 border-t bg-background/95 backdrop-blur py-4 px-4">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                disabled={isLoading || !isProviderReady}
                className="min-h-[48px] flex-1 text-base"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim() || !isProviderReady}
                size="icon"
                className="h-12 w-12 shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>

      {/* Rename thread dialog */}
      <Dialog open={!!renameThreadId} onOpenChange={(open) => !open && setRenameThreadId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            placeholder="Conversation title"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameThreadId(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!renameThreadId || !renameTitle.trim()) return;
                try {
                  await supabase
                    .from("ai_chat_threads")
                    .update({ title: renameTitle.trim() })
                    .eq("id", renameThreadId);
                  fetchThreads();
                  setRenameThreadId(null);
                  toast.success("Conversation renamed");
                } catch (e) {
                  console.error(e);
                  toast.error("Failed to rename");
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete thread confirmation */}
      <AlertDialog open={!!deleteThreadId} onOpenChange={(open) => !open && setDeleteThreadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. All messages in this conversation will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteThreadId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteThreadId) return;
                try {
                  const { data: threadToDelete, error: lookupError } = await supabase
                    .from("ai_chat_threads")
                    .select("metadata")
                    .eq("id", deleteThreadId)
                    .maybeSingle();
                  if (lookupError) throw lookupError;

                  const linkedConversationId =
                    getConversationIdFromMetadata(threadToDelete?.metadata) ??
                    (threadId === deleteThreadId ? conversationId : null);

                  if (linkedConversationId) {
                    const { error: conversationDeleteError } = await supabase
                      .from("agent_conversations")
                      .delete()
                      .eq("id", linkedConversationId);
                    if (conversationDeleteError) throw conversationDeleteError;
                  }

                  const { error: threadDeleteError } = await supabase
                    .from("ai_chat_threads")
                    .delete()
                    .eq("id", deleteThreadId);
                  if (threadDeleteError) throw threadDeleteError;

                  if (threadId === deleteThreadId) {
                    setMessages([]);
                    setThreadId(null);
                    setConversationId(null);
                  }
                  fetchThreads();
                  setDeleteThreadId(null);
                  toast.success("Conversation deleted");
                } catch (e) {
                  console.error(e);
                  toast.error("Failed to delete");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
