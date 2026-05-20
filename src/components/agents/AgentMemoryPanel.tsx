import { format } from "date-fns";
import { Brain, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useAgentMemories,
  useForgetAgentMemory,
  type AgentMemoryRow,
} from "@/hooks/useAgentConversations";

interface AgentMemoryPanelProps {
  agentId: string;
  userId: string;
}

function memoryTypeLabel(row: AgentMemoryRow): string {
  if (row.memory_category) return row.memory_category;
  return row.memory_type.replace("_", " ");
}

export function AgentMemoryPanel({ agentId, userId }: AgentMemoryPanelProps) {
  const { data: memories = [], isLoading, isError, refetch } = useAgentMemories(agentId, userId);
  const forgetMemory = useForgetAgentMemory(agentId, userId);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-3 py-6 text-center text-sm text-muted-foreground">
        Could not load memories.
        <Button variant="link" size="sm" className="mt-1" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <Brain className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium">No stored memories yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[240px] mx-auto">
          Memories are extracted after each chat when memory is enabled on this agent.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-[180px]">
      <div className="space-y-2 px-2 pb-3">
        {memories.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border bg-background/80 px-3 py-2.5 text-left shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-1 min-w-0">
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {memoryTypeLabel(m)}
                </Badge>
                {m.importance_score >= 0.7 && (
                  <Badge variant="outline" className="text-[10px]">
                    High importance
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Forget memory"
                disabled={forgetMemory.isPending}
                onClick={() => forgetMemory.mutate(m.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-sm mt-1.5 break-words leading-snug">{m.content}</p>
            <p className="text-[10px] text-muted-foreground mt-2">
              {format(new Date(m.created_at), "MMM d, yyyy")}
              {m.access_count > 0 ? ` · used ${m.access_count}×` : ""}
            </p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
