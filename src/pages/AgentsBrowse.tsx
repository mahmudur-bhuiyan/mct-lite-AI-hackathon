import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Bot, MessageSquare, BarChart3, ListTodo, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRoleFilteredAgents, type AIAgent, type AgentMetadata } from "@/hooks/useAIAgents";

const SECTION_PALETTES = [
  { sectionBadgeBg: "bg-fuchsia-600", cardGradientFrom: "296 91% 38%", cardGradientTo: "330 81% 47%" }, // magenta
  { sectionBadgeBg: "bg-cyan-600", cardGradientFrom: "186 94% 37%", cardGradientTo: "207 90% 54%" }, // cyan-blue
  { sectionBadgeBg: "bg-orange-600", cardGradientFrom: "20 90% 48%", cardGradientTo: "42 96% 52%" }, // orange
  { sectionBadgeBg: "bg-emerald-600", cardGradientFrom: "145 63% 36%", cardGradientTo: "160 84% 40%" }, // green
  { sectionBadgeBg: "bg-violet-600", cardGradientFrom: "258 90% 52%", cardGradientTo: "278 88% 57%" }, // violet
  { sectionBadgeBg: "bg-rose-600", cardGradientFrom: "340 82% 52%", cardGradientTo: "6 78% 56%" }, // rose-red
];

function formatCategoryLabel(category: string | null) {
  if (!category) return "General";
  return category
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function normalizeCategoryKey(category: string | null) {
  if (!category) return "general";
  return category.trim().toLowerCase().replace(/\s+/g, "_");
}

function getAvatar(agent: AIAgent) {
  const meta = (agent.metadata as AgentMetadata | null) ?? {};
  return meta.avatar || "🤖";
}

function inferCategoryIcon(category: string): React.ComponentType<{ className?: string }> {
  if (category.includes("meeting") || category.includes("chat") || category.includes("communication")) return MessageSquare;
  if (category.includes("analysis") || category.includes("insight") || category.includes("risk")) return BarChart3;
  if (category.includes("task") || category.includes("action") || category.includes("pipeline")) return ListTodo;
  return Layers;
}

function inferCategoryDescription(category: string, categoryLabel: string): string {
  if (category.includes("sales")) return "AI agents that help close more deals";
  if (category.includes("meeting")) return "Turn every meeting into structured, actionable outcomes";
  if (category.includes("strategy") || category.includes("eos")) return "Align your team around goals and strategic priorities";
  if (category.includes("project")) return "Accelerate delivery with AI-powered project intelligence";
  if (category.includes("communication")) return "AI agents for clear borrower and team communication";
  if (category.includes("analysis") || category.includes("insight")) return "AI agents for insights and smarter decision support";
  if (category.includes("task") || category.includes("action")) return "AI agents to prioritize and execute work efficiently";

  const lowerLabel = categoryLabel.toLowerCase();
  const normalized = normalizeCategoryKey(categoryLabel);
  const templates = [
    `Built to streamline ${lowerLabel} operations with practical AI support`,
    `Purpose-built assistants for faster ${lowerLabel} decisions and execution`,
    `Smart copilots that make ${lowerLabel} workflows easier and more consistent`,
    `AI teammates focused on improving day-to-day ${lowerLabel} outcomes`,
    `Designed to simplify ${lowerLabel} work with clear, actionable guidance`,
  ];

  // Deterministically rotate template by category for consistent UX.
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) % 2147483647;
  }

  return templates[Math.abs(hash) % templates.length];
}

function buildSectionMeta(category: string, agents: AIAgent[]) {
  const categoryLabel = formatCategoryLabel(category);
  return {
    sectionTitle: `${categoryLabel} Team`,
    tagline: inferCategoryDescription(category, categoryLabel),
    sectionIcon: inferCategoryIcon(category),
    categoryLabel,
  };
}

export default function AgentsBrowse() {
  const navigate = useNavigate();
  const { data: visibleAgents = [], isLoading } = useRoleFilteredAgents();

  const enabledAgents = useMemo(
    () => [...visibleAgents].sort((a, b) => a.name.localeCompare(b.name)),
    [visibleAgents]
  );

  const groupedAgents = useMemo(() => {
    const groups = new Map<string, AIAgent[]>();
    for (const agent of enabledAgents) {
      const key = normalizeCategoryKey(agent.category);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(agent);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [enabledAgents]);

  return (
    <div className="space-y-12 p-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Sparkles className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">AI Agents</h1>
        </div>
        <p className="text-muted-foreground text-base">
          Browse the currently enabled agents configured in Admin
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
          Loading agents...
        </div>
      ) : enabledAgents.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Bot className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">No enabled agents available</p>
          <p className="text-sm text-muted-foreground">
            Ask an admin to enable agents in Admin → AI Agents.
          </p>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Agent Teams</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {groupedAgents.map(([category, agents], sectionIndex) => {
                const sectionTheme = buildSectionMeta(category, agents);
                const palette = SECTION_PALETTES[sectionIndex % SECTION_PALETTES.length];
                const TeamIcon = sectionTheme.sectionIcon;
                const previewAgents = agents.slice(0, 4);
                return (
                  <div
                    key={`team-${category}`}
                    className="rounded-2xl border border-border bg-card p-6 shadow-md hover:shadow-xl transition-all duration-300"
                    style={{
                      borderBottomWidth: "4px",
                      borderBottomColor: `hsl(${palette.cardGradientTo})`,
                    }}
                  >
                    <div className="flex -space-x-3 mb-5">
                      <div
                        className="h-12 w-12 rounded-full flex items-center justify-center text-white ring-[3px] ring-background shadow-md"
                        style={{
                          background: `linear-gradient(135deg, hsl(${palette.cardGradientFrom}), hsl(${palette.cardGradientTo}))`,
                          zIndex: 10,
                        }}
                      >
                        <TeamIcon className="h-5 w-5" />
                      </div>
                      {previewAgents.map((agent, avatarIndex) => (
                        <button
                          key={`${category}-${agent.slug}`}
                          type="button"
                          title={`Chat with ${agent.name}`}
                          aria-label={`Chat with ${agent.name}`}
                          onClick={() => navigate(`/agents/${agent.id}/chat`)}
                          className="h-12 w-12 rounded-full flex items-center justify-center text-xl ring-[3px] ring-background shadow-md bg-card transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary"
                          style={{
                            background: `linear-gradient(135deg, hsl(${palette.cardGradientFrom} / 0.2), hsl(${palette.cardGradientTo} / 0.2))`,
                            zIndex: 9 - avatarIndex,
                          }}
                        >
                          {getAvatar(agent)}
                        </button>
                      ))}
                    </div>

                    <h3 className="text-3xl font-bold text-foreground mb-1">{sectionTheme.sectionTitle}</h3>
                    <p className="text-muted-foreground mb-5">{sectionTheme.tagline}</p>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const sectionEl = document.getElementById(`team-${category}`);
                        sectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      Explore Team
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          {groupedAgents.map(([category, agents], sectionIndex) => {
            const sectionTheme = buildSectionMeta(category, agents);
            const palette = SECTION_PALETTES[sectionIndex % SECTION_PALETTES.length];
            const TeamIcon = sectionTheme.sectionIcon;
            return (
              <section key={category} id={`team-${category}`} className="space-y-4 scroll-mt-24">
            <div className="flex items-start gap-3">
              <div className={`h-11 w-11 shrink-0 rounded-xl ${palette.sectionBadgeBg} flex items-center justify-center shadow-sm`}>
                <TeamIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{sectionTheme.sectionTitle}</h2>
                <p className="text-muted-foreground text-sm">{sectionTheme.tagline}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {agents.map((agent) => (
                <div
                  key={agent.slug}
                  className="group rounded-2xl border border-border overflow-hidden bg-card shadow-md hover:shadow-xl transition-all duration-300 flex flex-col"
                >
                  <div
                    className="h-24 relative"
                    style={{
                      background: `linear-gradient(135deg, hsl(${palette.cardGradientFrom}), hsl(${palette.cardGradientTo}))`,
                    }}
                  >
                    <Badge className="absolute top-3 right-3 border-0 bg-background/90 text-foreground">
                      {sectionTheme.categoryLabel}
                    </Badge>
                    <div className="absolute -bottom-6 left-5 h-12 w-12 rounded-full bg-slate-900 border-[3px] border-background flex items-center justify-center text-xl shadow-lg">
                      <span className="translate-y-[1px]">{getAvatar(agent)}</span>
                    </div>
                  </div>
                  <div className="pt-8 px-5 pb-5 flex flex-col flex-1">
                    <p className="text-lg font-semibold text-foreground leading-tight">{agent.name}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mt-2 flex-1">
                      {agent.description?.trim() || "No description provided."}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/agents/${agent.id}/chat`)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1.5" /> Chat
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/agents/${agent.slug}`)}
                      >
                        Customize
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
