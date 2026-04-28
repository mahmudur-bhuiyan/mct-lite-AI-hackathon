/**
 * Built-in tool executor for the run-ai-agent dispatcher (L3).
 *
 * Provides server-side implementations for the standard tools that agents
 * can invoke via OpenAI function calling.  Each built-in function name maps
 * to a handler that queries Supabase and returns a JSON-serialisable result.
 *
 * Adding a new tool:
 *   1. Register its ToolDefinition in BUILT_IN_TOOLS below.
 *   2. Add a case in executeBuiltInTool().
 *   3. Optionally surface the slug in ai_agents.tools_config to opt-in agents.
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ToolDefinition } from './ai-utils.ts';

// ── Built-in tool catalogue ───────────────────────────────────────────────────

export const BUILT_IN_TOOLS: Record<string, ToolDefinition> = {
  search_loans: {
    type: 'function',
    function: {
      name: 'search_loans',
      description: 'Search mortgage loans by borrower name, loan number, or status. Returns a list of matching loans with key fields.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Free-text search term (borrower name, loan number, address, etc.)',
          },
          status: {
            type: 'string',
            description: 'Filter by loan status (e.g. "processing", "approved", "closed")',
          },
          limit: {
            type: 'string',
            description: 'Maximum number of results to return (default 10)',
          },
        },
        required: ['query'],
      },
    },
  },

  get_loan_details: {
    type: 'function',
    function: {
      name: 'get_loan_details',
      description: 'Retrieve full details of a specific loan by its ID or loan number, including borrower info, financials, milestones, and conditions.',
      parameters: {
        type: 'object',
        properties: {
          loan_id: {
            type: 'string',
            description: 'UUID of the loan record',
          },
          loan_number: {
            type: 'string',
            description: 'Human-readable loan number (alternative to loan_id)',
          },
        },
      },
    },
  },

  search_knowledge_base: {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description: 'Search the knowledge base for relevant documents, guidelines, or policies using keyword search.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          limit: {
            type: 'string',
            description: 'Maximum number of results (default 5)',
          },
        },
        required: ['query'],
      },
    },
  },

  get_pipeline_summary: {
    type: 'function',
    function: {
      name: 'get_pipeline_summary',
      description: 'Get an aggregate summary of the current loan pipeline: counts by status, average loan amounts, stale loans, etc.',
      parameters: {
        type: 'object',
        properties: {
          loan_officer_id: {
            type: 'string',
            description: 'Filter pipeline to a specific loan officer UUID (omit for all loans)',
          },
        },
      },
    },
  },
};

// ── Executor ─────────────────────────────────────────────────────────────────

export interface ToolCallResult {
  tool_call_id: string;
  name: string;
  content: string; // JSON-serialised result returned to the model
}

/**
 * Execute a single tool call requested by the model.
 *
 * @param toolCallId  The id field from the model's tool_call object.
 * @param name        Function name (must match a key in BUILT_IN_TOOLS or agent-defined tools).
 * @param args        Parsed JSON arguments from the model.
 * @param supabase    Service-role Supabase client for DB access.
 * @param userId      Authenticated user's UUID (used for RLS fallthrough on service role).
 * @returns           A ToolCallResult ready to append to the messages array as role='tool'.
 */
export async function executeBuiltInTool(
  toolCallId: string,
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  _userId: string,
): Promise<ToolCallResult> {
  let result: unknown;

  try {
    switch (name) {
      case 'search_loans': {
        const query = String(args.query ?? '');
        const status = args.status ? String(args.status) : undefined;
        const limit = Math.min(Number(args.limit ?? 10), 25);

        let qb = supabase
          .from('loans')
          .select('id, loan_number, borrower_name, loan_amount, status, loan_type, property_address, created_at')
          .limit(limit);

        if (query) {
          qb = qb.or(
            `borrower_name.ilike.%${query}%,loan_number.ilike.%${query}%,property_address.ilike.%${query}%`,
          );
        }
        if (status) qb = qb.eq('status', status);

        const { data, error } = await qb;
        if (error) throw error;
        result = data ?? [];
        break;
      }

      case 'get_loan_details': {
        const loanId = args.loan_id ? String(args.loan_id) : undefined;
        const loanNumber = args.loan_number ? String(args.loan_number) : undefined;

        if (!loanId && !loanNumber) {
          result = { error: 'Provide either loan_id or loan_number.' };
          break;
        }

        let qb = supabase
          .from('loans')
          .select(`
            *,
            loan_milestones(*),
            loan_conditions(*)
          `)
          .limit(1);

        if (loanId) qb = qb.eq('id', loanId);
        else if (loanNumber) qb = qb.eq('loan_number', loanNumber);

        const { data, error } = await qb.maybeSingle();
        if (error) throw error;
        result = data ?? { error: 'Loan not found.' };
        break;
      }

      case 'search_knowledge_base': {
        const query = String(args.query ?? '');
        const limit = Math.min(Number(args.limit ?? 5), 15);

        const { data, error } = await supabase
          .from('knowledge_entries')
          .select('id, title, content, category, created_at')
          .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
          .limit(limit);

        if (error) throw error;
        result = data ?? [];
        break;
      }

      case 'get_pipeline_summary': {
        const loanOfficerId = args.loan_officer_id ? String(args.loan_officer_id) : undefined;

        let qb = supabase
          .from('loans')
          .select('status, loan_amount, created_at, updated_at');

        if (loanOfficerId) qb = qb.eq('loan_officer_id', loanOfficerId);

        const { data, error } = await qb;
        if (error) throw error;

        const loans = (data ?? []) as Array<{
          status: string;
          loan_amount: number;
          created_at: string;
          updated_at: string;
        }>;

        const byStatus: Record<string, number> = {};
        let totalAmount = 0;
        const now = Date.now();
        let stale = 0;

        for (const l of loans) {
          byStatus[l.status] = (byStatus[l.status] ?? 0) + 1;
          totalAmount += l.loan_amount ?? 0;
          const daysSinceUpdate = (now - new Date(l.updated_at).getTime()) / 86_400_000;
          if (daysSinceUpdate > 14) stale++;
        }

        result = {
          total: loans.length,
          by_status: byStatus,
          average_loan_amount: loans.length ? Math.round(totalAmount / loans.length) : 0,
          stale_loans_14d: stale,
        };
        break;
      }

      default:
        result = { error: `Unknown built-in tool: ${name}` };
    }
  } catch (err) {
    result = { error: (err as Error).message };
  }

  return {
    tool_call_id: toolCallId,
    name,
    content: JSON.stringify(result),
  };
}

/**
 * Merge agent-defined tools from tools_config with the built-in catalogue.
 * Agent-defined tools override built-ins with the same name.
 */
export function resolveAgentTools(toolsConfig: unknown[]): ToolDefinition[] {
  const merged: Map<string, ToolDefinition> = new Map(
    Object.entries(BUILT_IN_TOOLS).map(([k, v]) => [k, v]),
  );

  for (const t of toolsConfig) {
    const tool = t as ToolDefinition;
    if (tool?.type === 'function' && tool.function?.name) {
      merged.set(tool.function.name, tool);
    }
  }

  return Array.from(merged.values());
}
