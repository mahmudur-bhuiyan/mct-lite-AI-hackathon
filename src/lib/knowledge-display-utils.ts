import { formatDate } from "@/lib/utils";

type KnowledgeEntryDateSource = {
  created_at: string;
  metadata?: unknown;
  author_id?: string | null;
};

/** Optional display date override in metadata.display_date (e.g. demo backfill for older uploads). */
export function getKnowledgeEntryDisplayDate(entry: KnowledgeEntryDateSource): string {
  const meta = entry.metadata as { display_date?: string } | null | undefined;
  const override = meta?.display_date?.trim();
  if (override) return override;
  return entry.created_at;
}

export function formatKnowledgeEntryDate(entry: KnowledgeEntryDateSource): string {
  return formatDate(getKnowledgeEntryDisplayDate(entry));
}

export function canManageKnowledgeEntry(
  userId: string | undefined,
  userRole: string | null | undefined,
  entry: { author_id?: string | null; created_by?: string | null } | null | undefined,
): boolean {
  if (!userId || !entry) return false;
  if (userRole === "admin") return true;
  return entry.author_id === userId;
}
