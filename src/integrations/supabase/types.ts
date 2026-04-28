export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      action_items: {
        Row: {
          agent_id: string | null
          assigned_by_user_id: string | null
          assigned_to_user_id: string
          completed_at: string | null
          created_at: string
          created_by_user_id: string | null
          description: string | null
          due_date: string | null
          id: string
          loan_id: string | null
          metadata: Json
          priority: string
          source: string
          start_date: string | null
          status: string
          task_type: string | null
          title: string
          updated_at: string
          watchers: string[]
        }
        Insert: {
          agent_id?: string | null
          assigned_by_user_id?: string | null
          assigned_to_user_id: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          loan_id?: string | null
          metadata?: Json
          priority?: string
          source?: string
          start_date?: string | null
          status?: string
          task_type?: string | null
          title: string
          updated_at?: string
          watchers?: string[]
        }
        Update: {
          agent_id?: string | null
          assigned_by_user_id?: string | null
          assigned_to_user_id?: string
          completed_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          loan_id?: string | null
          metadata?: Json
          priority?: string
          source?: string
          start_date?: string | null
          status?: string
          task_type?: string | null
          title?: string
          updated_at?: string
          watchers?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "action_items_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_agent_runs: {
        Row: {
          agent_id: string
          context: Json | null
          created_at: string
          error_message: string | null
          id: string
          input: string | null
          latency_ms: number | null
          metadata: Json | null
          model_used: string | null
          output: string | null
          provider_used: string | null
          status: string | null
          token_metrics: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agent_id: string
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: string | null
          latency_ms?: number | null
          metadata?: Json | null
          model_used?: string | null
          output?: string | null
          provider_used?: string | null
          status?: string | null
          token_metrics?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string
          context?: Json | null
          created_at?: string
          error_message?: string | null
          id?: string
          input?: string | null
          latency_ms?: number | null
          metadata?: Json | null
          model_used?: string | null
          output?: string | null
          provider_used?: string | null
          status?: string | null
          token_metrics?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          category: string | null
          created_at: string
          data_sources: string[] | null
          description: string | null
          id: string
          is_enabled: boolean
          memory_enabled: boolean
          metadata: Json | null
          name: string
          provider_config: Json | null
          required_role: string | null
          slug: string
          system_prompt: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          data_sources?: string[] | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          memory_enabled?: boolean
          metadata?: Json | null
          name: string
          provider_config?: Json | null
          required_role?: string | null
          slug: string
          system_prompt?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          data_sources?: string[] | null
          description?: string | null
          id?: string
          is_enabled?: boolean
          memory_enabled?: boolean
          metadata?: Json | null
          name?: string
          provider_config?: Json | null
          required_role?: string | null
          slug?: string
          system_prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_chat_threads: {
        Row: {
          agent_slug: string | null
          created_at: string
          id: string
          last_message_at: string
          messages: Json
          metadata: Json | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_slug?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          messages?: Json
          metadata?: Json | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_slug?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          messages?: Json
          metadata?: Json | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      all_US_zipcode: {
        Row: {
          county: string | null
          county_state: string | null
          id: string | null
          usps_default_city: string | null
          usps_default_state: string | null
          zip_code: number | null
        }
        Insert: {
          county?: string | null
          county_state?: string | null
          id?: string | null
          usps_default_city?: string | null
          usps_default_state?: string | null
          zip_code?: number | null
        }
        Update: {
          county?: string | null
          county_state?: string | null
          id?: string | null
          usps_default_city?: string | null
          usps_default_state?: string | null
          zip_code?: number | null
        }
        Relationships: []
      }
      borrower_communications: {
        Row: {
          agent_id: string | null
          approved_at: string | null
          approved_by: string | null
          audience: string
          channel: string
          confidence: string | null
          created_at: string
          created_by_user_id: string
          doc_type: string
          draft_content: string
          draft_version: number
          id: string
          length_pref: string | null
          loan_id: string
          metadata: Json
          missing_data_notes: Json
          prompt_context: Json
          rejected_at: string | null
          sent_at: string | null
          status: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          audience?: string
          channel?: string
          confidence?: string | null
          created_at?: string
          created_by_user_id: string
          doc_type: string
          draft_content?: string
          draft_version?: number
          id?: string
          length_pref?: string | null
          loan_id: string
          metadata?: Json
          missing_data_notes?: Json
          prompt_context?: Json
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          audience?: string
          channel?: string
          confidence?: string | null
          created_at?: string
          created_by_user_id?: string
          doc_type?: string
          draft_content?: string
          draft_version?: number
          id?: string
          length_pref?: string | null
          loan_id?: string
          metadata?: Json
          missing_data_notes?: Json
          prompt_context?: Json
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "borrower_communications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrower_communications_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      borrowers: {
        Row: {
          api_payload: Json | null
          city: string | null
          created_at: string
          created_by: string | null
          data_source: string | null
          date_of_birth: string | null
          email: string | null
          external_id: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          postal_code: string | null
          ssn_last4: string | null
          state: string | null
          street_address: string | null
          updated_at: string
        }
        Insert: {
          api_payload?: Json | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          date_of_birth?: string | null
          email?: string | null
          external_id?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          postal_code?: string | null
          ssn_last4?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
        }
        Update: {
          api_payload?: Json | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          date_of_birth?: string | null
          email?: string | null
          external_id?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          postal_code?: string | null
          ssn_last4?: string | null
          state?: string | null
          street_address?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          company: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          metadata: Json | null
          name: string
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name: string
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      edge_functions: {
        Row: {
          created_at: string | null
          deployed_at: string | null
          description: string | null
          id: string
          invocation_count: number | null
          last_invoked_at: string | null
          name: string
          status: string | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          deployed_at?: string | null
          description?: string | null
          id?: string
          invocation_count?: number | null
          last_invoked_at?: string | null
          name: string
          status?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          deployed_at?: string | null
          description?: string | null
          id?: string
          invocation_count?: number | null
          last_invoked_at?: string | null
          name?: string
          status?: string | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          rating: number | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          rating?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          rating?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          api_key: string | null
          api_key_masked: string | null
          config: Json | null
          created_at: string | null
          created_by: string | null
          display_name: string
          id: string
          is_active: boolean | null
          last_validated_at: string | null
          provider_name: string
          updated_at: string | null
          updated_by: string | null
          validation_error: string | null
          validation_status: string | null
        }
        Insert: {
          api_key?: string | null
          api_key_masked?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          last_validated_at?: string | null
          provider_name: string
          updated_at?: string | null
          updated_by?: string | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Update: {
          api_key?: string | null
          api_key_masked?: string | null
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          last_validated_at?: string | null
          provider_name?: string
          updated_at?: string | null
          updated_by?: string | null
          validation_error?: string | null
          validation_status?: string | null
        }
        Relationships: []
      }
      knowledge_categories: {
        Row: {
          aliases: string[]
          archived_at: string | null
          color: string | null
          created_at: string | null
          deprecated_at: string | null
          description: string | null
          effective_date: string | null
          governance_owner_role: string | null
          icon: string | null
          id: string
          is_regulatory_critical: boolean
          lifecycle_state: string
          metadata: Json | null
          name: string
          parent_id: string | null
          review_cadence_days: number | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          aliases?: string[]
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          deprecated_at?: string | null
          description?: string | null
          effective_date?: string | null
          governance_owner_role?: string | null
          icon?: string | null
          id?: string
          is_regulatory_critical?: boolean
          lifecycle_state?: string
          metadata?: Json | null
          name: string
          parent_id?: string | null
          review_cadence_days?: number | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          aliases?: string[]
          archived_at?: string | null
          color?: string | null
          created_at?: string | null
          deprecated_at?: string | null
          description?: string | null
          effective_date?: string | null
          governance_owner_role?: string | null
          icon?: string | null
          id?: string
          is_regulatory_critical?: boolean
          lifecycle_state?: string
          metadata?: Json | null
          name?: string
          parent_id?: string | null
          review_cadence_days?: number | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_entries: {
        Row: {
          author_id: string | null
          category_id: string | null
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          slug: string
          status: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          slug: string
          status?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          slug?: string
          status?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_conditions: {
        Row: {
          category: string | null
          condition_type: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          external_id: string | null
          id: string
          loan_id: string
          notes: string | null
          received_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          condition_type: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          external_id?: string | null
          id?: string
          loan_id: string
          notes?: string | null
          received_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          condition_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          external_id?: string | null
          id?: string
          loan_id?: string
          notes?: string | null
          received_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_conditions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_adverse_actions: {
        Row: {
          id: string
          loan_id: string
          status: string
          decision: string | null
          reason_codes: Json
          narrative: string | null
          generated_at: string | null
          mailed_at: string | null
          notes: string | null
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          status?: string
          decision?: string | null
          reason_codes?: Json
          narrative?: string | null
          generated_at?: string | null
          mailed_at?: string | null
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          status?: string
          decision?: string | null
          reason_codes?: Json
          narrative?: string | null
          generated_at?: string | null
          mailed_at?: string | null
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_adverse_actions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_appraisal_orders: {
        Row: {
          id: string
          loan_id: string
          status: string
          vendor_name: string | null
          amc_reference: string | null
          appraisal_fee: number | null
          ordered_at: string | null
          inspection_date: string | null
          report_received_at: string | null
          notes: string | null
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          status?: string
          vendor_name?: string | null
          amc_reference?: string | null
          appraisal_fee?: number | null
          ordered_at?: string | null
          inspection_date?: string | null
          report_received_at?: string | null
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          status?: string
          vendor_name?: string | null
          amc_reference?: string | null
          appraisal_fee?: number | null
          ordered_at?: string | null
          inspection_date?: string | null
          report_received_at?: string | null
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_appraisal_orders_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_borrower_uploads: {
        Row: {
          id: string
          loan_id: string
          borrower_id: string
          loan_condition_id: string | null
          storage_path: string
          file_name: string
          mime_type: string
          byte_size: number
          submitted_at: string
          review_status: string
          reviewed_by: string | null
          reviewed_at: string | null
          review_notes: string | null
          source: string
        }
        Insert: {
          id?: string
          loan_id: string
          borrower_id: string
          loan_condition_id?: string | null
          storage_path: string
          file_name: string
          mime_type: string
          byte_size: number
          submitted_at?: string
          review_status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          source?: string
        }
        Update: {
          id?: string
          loan_id?: string
          borrower_id?: string
          loan_condition_id?: string | null
          storage_path?: string
          file_name?: string
          mime_type?: string
          byte_size?: number
          submitted_at?: string
          review_status?: string
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_borrower_uploads_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_digital_closing: {
        Row: {
          id: string
          loan_id: string
          eclose_package_status: string
          enote_status: string
          closing_scheduled_date: string | null
          closing_completed_at: string | null
          package_sent_at: string | null
          vendor_name: string | null
          notes: string | null
          metadata: Json
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          eclose_package_status?: string
          enote_status?: string
          closing_scheduled_date?: string | null
          closing_completed_at?: string | null
          package_sent_at?: string | null
          vendor_name?: string | null
          notes?: string | null
          metadata?: Json
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          eclose_package_status?: string
          enote_status?: string
          closing_scheduled_date?: string | null
          closing_completed_at?: string | null
          package_sent_at?: string | null
          vendor_name?: string | null
          notes?: string | null
          metadata?: Json
          updated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_digital_closing_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_ron_sessions: {
        Row: {
          id: string
          loan_id: string
          status: string
          vendor_name: string | null
          provider_session_ref: string | null
          scheduled_at: string | null
          completed_at: string | null
          notes: string | null
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          status?: string
          vendor_name?: string | null
          provider_session_ref?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          status?: string
          vendor_name?: string | null
          provider_session_ref?: string | null
          scheduled_at?: string | null
          completed_at?: string | null
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_ron_sessions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_settlement_orders: {
        Row: {
          id: string
          loan_id: string
          order_type: string
          status: string
          vendor_name: string | null
          reference_number: string | null
          ordered_at: string | null
          expected_date: string | null
          completed_at: string | null
          notes: string | null
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          order_type: string
          status?: string
          vendor_name?: string | null
          reference_number?: string | null
          ordered_at?: string | null
          expected_date?: string | null
          completed_at?: string | null
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          order_type?: string
          status?: string
          vendor_name?: string | null
          reference_number?: string | null
          ordered_at?: string | null
          expected_date?: string | null
          completed_at?: string | null
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_settlement_orders_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      hmda_lar_entries: {
        Row: {
          id: string
          loan_id: string
          filing_year: number
          is_reportable: boolean
          action_taken: string | null
          action_taken_date: string | null
          loan_purpose: string | null
          loan_type: string | null
          occupancy_type: string | null
          lien_status: string | null
          purchaser_type: string | null
          hoepa_status: string | null
          rate_spread: number | null
          denial_reasons: Json
          lar_payload: Json
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          filing_year?: number
          is_reportable?: boolean
          action_taken?: string | null
          action_taken_date?: string | null
          loan_purpose?: string | null
          loan_type?: string | null
          occupancy_type?: string | null
          lien_status?: string | null
          purchaser_type?: string | null
          hoepa_status?: string | null
          rate_spread?: number | null
          denial_reasons?: Json
          lar_payload?: Json
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          loan_id?: string
          filing_year?: number
          is_reportable?: boolean
          action_taken?: string | null
          action_taken_date?: string | null
          loan_purpose?: string | null
          loan_type?: string | null
          occupancy_type?: string | null
          lien_status?: string | null
          purchaser_type?: string | null
          hoepa_status?: string | null
          rate_spread?: number | null
          denial_reasons?: Json
          lar_payload?: Json
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hmda_lar_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      hmda_report_runs: {
        Row: {
          id: string
          filing_year: number
          total_rows: number
          included_rows: number
          excluded_rows: number
          export_format: string
          filters: Json
          summary: Json
          generated_by: string | null
          generated_at: string
        }
        Insert: {
          id?: string
          filing_year: number
          total_rows?: number
          included_rows?: number
          excluded_rows?: number
          export_format?: string
          filters?: Json
          summary?: Json
          generated_by?: string | null
          generated_at?: string
        }
        Update: {
          id?: string
          filing_year?: number
          total_rows?: number
          included_rows?: number
          excluded_rows?: number
          export_format?: string
          filters?: Json
          summary?: Json
          generated_by?: string | null
          generated_at?: string
        }
        Relationships: []
      }
      nmls_licenses: {
        Row: {
          id: string
          holder_type: string
          holder_name: string
          holder_user_id: string | null
          nmls_id: string | null
          state_code: string
          license_number: string
          status: string
          issue_date: string | null
          expiration_date: string | null
          renewed_at: string | null
          notes: string | null
          metadata: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          holder_type: string
          holder_name?: string
          holder_user_id?: string | null
          nmls_id?: string | null
          state_code: string
          license_number?: string
          status?: string
          issue_date?: string | null
          expiration_date?: string | null
          renewed_at?: string | null
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          holder_type?: string
          holder_name?: string
          holder_user_id?: string | null
          nmls_id?: string | null
          state_code?: string
          license_number?: string
          status?: string
          issue_date?: string | null
          expiration_date?: string | null
          renewed_at?: string | null
          notes?: string | null
          metadata?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      borrower_portal_invites: {
        Row: {
          id: string
          token_hash: string
          loan_id: string
          borrower_id: string
          expires_at: string
          consumed_at: string | null
          created_by: string | null
          created_at: string
          redeemed_ip: string | null
        }
        Insert: {
          id?: string
          token_hash: string
          loan_id: string
          borrower_id: string
          expires_at: string
          consumed_at?: string | null
          created_by?: string | null
          created_at?: string
          redeemed_ip?: string | null
        }
        Update: {
          id?: string
          token_hash?: string
          loan_id?: string
          borrower_id?: string
          expires_at?: string
          consumed_at?: string | null
          created_by?: string | null
          created_at?: string
          redeemed_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrower_portal_invites_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_milestones: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          external_id: string | null
          id: string
          loan_id: string
          milestone_type: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          loan_id: string
          milestone_type: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          loan_id?: string
          milestone_type?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_milestones_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_pricing_calculations: {
        Row: {
          calculated_price: number | null
          calculated_rate: number | null
          conditions_text: string | null
          created_at: string
          credit_score: number | null
          eligibility_status: string | null
          id: string
          loan_amount: number | null
          loan_id: string | null
          lock_term_days: number | null
          ltv: number | null
          product_selected: string | null
          property_value: number | null
          raw_match_metadata: Json
          state: string | null
          user_id: string
        }
        Insert: {
          calculated_price?: number | null
          calculated_rate?: number | null
          conditions_text?: string | null
          created_at?: string
          credit_score?: number | null
          eligibility_status?: string | null
          id?: string
          loan_amount?: number | null
          loan_id?: string | null
          lock_term_days?: number | null
          ltv?: number | null
          product_selected?: string | null
          property_value?: number | null
          raw_match_metadata?: Json
          state?: string | null
          user_id: string
        }
        Update: {
          calculated_price?: number | null
          calculated_rate?: number | null
          conditions_text?: string | null
          created_at?: string
          credit_score?: number | null
          eligibility_status?: string | null
          id?: string
          loan_amount?: number | null
          loan_id?: string | null
          lock_term_days?: number | null
          ltv?: number | null
          product_selected?: string | null
          property_value?: number | null
          raw_match_metadata?: Json
          state?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_pricing_calculations_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_products: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          product_name: string
          product_type: string
          rate_type: string
          term_months: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          product_name: string
          product_type: string
          rate_type: string
          term_months: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          product_name?: string
          product_type?: string
          rate_type?: string
          term_months?: number
          updated_at?: string
        }
        Relationships: []
      }
      loan_programs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          loan_limit: number | null
          max_dti: number | null
          max_ltv: number | null
          min_credit_score: number | null
          occupancy_type: string | null
          pricing_engine_code: string | null
          product_id: string
          program_code: string
          program_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          loan_limit?: number | null
          max_dti?: number | null
          max_ltv?: number | null
          min_credit_score?: number | null
          occupancy_type?: string | null
          pricing_engine_code?: string | null
          product_id: string
          program_code: string
          program_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          loan_limit?: number | null
          max_dti?: number | null
          max_ltv?: number | null
          min_credit_score?: number | null
          occupancy_type?: string | null
          pricing_engine_code?: string | null
          product_id?: string
          program_code?: string
          program_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_programs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_risk_alerts: {
        Row: {
          alert_type: string
          created_at: string
          dismissed_at: string | null
          id: string
          is_read: boolean
          loan_id: string
          message: string
          metadata: Json
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          is_read?: boolean
          loan_id: string
          message: string
          metadata?: Json
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          is_read?: boolean
          loan_id?: string
          message?: string
          metadata?: Json
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_risk_alerts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_risk_scores: {
        Row: {
          calculated_at: string
          condition_risk: number | null
          created_at: string
          id: string
          loan_id: string
          lock_expiry_risk: number | null
          overall_risk_score: number
          risk_factors: Json
          risk_level: string
          stall_risk: number | null
          updated_at: string
        }
        Insert: {
          calculated_at?: string
          condition_risk?: number | null
          created_at?: string
          id?: string
          loan_id: string
          lock_expiry_risk?: number | null
          overall_risk_score?: number
          risk_factors?: Json
          risk_level?: string
          stall_risk?: number | null
          updated_at?: string
        }
        Update: {
          calculated_at?: string
          condition_risk?: number | null
          created_at?: string
          id?: string
          loan_id?: string
          lock_expiry_risk?: number | null
          overall_risk_score?: number
          risk_factors?: Json
          risk_level?: string
          stall_risk?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_risk_scores_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_timeline_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_source: string
          event_type: string
          id: string
          loan_id: string
          metadata: Json | null
          occurred_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_source?: string
          event_type: string
          id?: string
          loan_id: string
          metadata?: Json | null
          occurred_at?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_source?: string
          event_type?: string
          id?: string
          loan_id?: string
          metadata?: Json | null
          occurred_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_timeline_events_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          api_payload: Json | null
          appraised_value: number | null
          borrower_id: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          credit_score: number | null
          data_source: string | null
          dti: number | null
          external_id: string | null
          id: string
          loan_amount: number | null
          loan_number: string
          loan_officer_id: string
          lock_date: string | null
          lock_expiration_date: string | null
          ltv: number | null
          occupancy_type: string | null
          product_id: string | null
          program_id: string | null
          property_address: string | null
          property_city: string | null
          property_postal_code: string | null
          property_state: string | null
          purpose: string | null
          status: string
          updated_at: string
        }
        Insert: {
          api_payload?: Json | null
          appraised_value?: number | null
          borrower_id: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_score?: number | null
          data_source?: string | null
          dti?: number | null
          external_id?: string | null
          id?: string
          loan_amount?: number | null
          loan_number: string
          loan_officer_id: string
          lock_date?: string | null
          lock_expiration_date?: string | null
          ltv?: number | null
          occupancy_type?: string | null
          product_id?: string | null
          program_id?: string | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          purpose?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          api_payload?: Json | null
          appraised_value?: number | null
          borrower_id?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_score?: number | null
          data_source?: string | null
          dti?: number | null
          external_id?: string | null
          id?: string
          loan_amount?: number | null
          loan_number?: string
          loan_officer_id?: string
          lock_date?: string | null
          lock_expiration_date?: string | null
          ltv?: number | null
          occupancy_type?: string | null
          product_id?: string | null
          program_id?: string | null
          property_address?: string | null
          property_city?: string | null
          property_postal_code?: string | null
          property_state?: string | null
          purpose?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "borrowers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loan_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      lock_alerts: {
        Row: {
          alert_date: string
          alert_type: string
          created_at: string
          dismissed_at: string | null
          id: string
          is_read: boolean
          loan_id: string
          message: string
          metadata: Json
          rate_lock_id: string
          sent: boolean
          title: string
        }
        Insert: {
          alert_date: string
          alert_type: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          is_read?: boolean
          loan_id: string
          message: string
          metadata?: Json
          rate_lock_id: string
          sent?: boolean
          title: string
        }
        Update: {
          alert_date?: string
          alert_type?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          is_read?: boolean
          loan_id?: string
          message?: string
          metadata?: Json
          rate_lock_id?: string
          sent?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lock_alerts_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lock_alerts_rate_lock_id_fkey"
            columns: ["rate_lock_id"]
            isOneToOne: false
            referencedRelation: "rate_locks"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          client_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          meeting_type: string
          metadata: Json | null
          organizer_id: string | null
          scheduled_at: string
          status: string
          title: string
          updated_at: string | null
          zoom_id: string | null
          zoom_join_url: string | null
          zoom_meeting_id: string | null
          zoom_start_url: string | null
          zoom_uuid: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_type?: string
          metadata?: Json | null
          organizer_id?: string | null
          scheduled_at: string
          status?: string
          title: string
          updated_at?: string | null
          zoom_id?: string | null
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_start_url?: string | null
          zoom_uuid?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          meeting_type?: string
          metadata?: Json | null
          organizer_id?: string | null
          scheduled_at?: string
          status?: string
          title?: string
          updated_at?: string | null
          zoom_id?: string | null
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_start_url?: string | null
          zoom_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      zoom_files: {
        Row: {
          id: string
          meeting_id: string | null
          zoom_meeting_uuid: string
          zoom_recording_file_id: string
          zoom_meeting_id: string | null
          file_type: string
          file_name: string
          file_size: number | null
          file_path: string | null
          storage_path: string | null
          download_url: string | null
          transcript_text: string | null
          transcript_content: Json | null
          is_processed: boolean
          has_embeddings: boolean
          processing_status: string
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id?: string | null
          zoom_meeting_uuid: string
          zoom_recording_file_id: string
          zoom_meeting_id?: string | null
          file_type?: string
          file_name?: string
          file_size?: number | null
          file_path?: string | null
          storage_path?: string | null
          download_url?: string | null
          transcript_text?: string | null
          transcript_content?: Json | null
          is_processed?: boolean
          has_embeddings?: boolean
          processing_status?: string
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string | null
          zoom_meeting_uuid?: string
          zoom_recording_file_id?: string
          zoom_meeting_id?: string | null
          file_type?: string
          file_name?: string
          file_size?: number | null
          file_path?: string | null
          storage_path?: string | null
          download_url?: string | null
          transcript_text?: string | null
          transcript_content?: Json | null
          is_processed?: boolean
          has_embeddings?: boolean
          processing_status?: string
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zoom_files_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      module_settings: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          enabled: boolean
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          enabled?: boolean
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          dedupe_key: string | null
          delivery_status: Json | null
          id: string
          is_read: boolean
          link: string | null
          message: string
          metadata: Json
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          delivery_status?: Json | null
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          metadata?: Json
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          delivery_status?: Json | null
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      product_eligibility_rules: {
        Row: {
          additional_conditions: Json
          allowed_states: string[] | null
          created_at: string
          id: string
          max_loan_amount: number | null
          max_ltv: number | null
          min_fico: number | null
          min_loan_amount: number | null
          product_name: string
        }
        Insert: {
          additional_conditions?: Json
          allowed_states?: string[] | null
          created_at?: string
          id?: string
          max_loan_amount?: number | null
          max_ltv?: number | null
          min_fico?: number | null
          min_loan_amount?: number | null
          product_name: string
        }
        Update: {
          additional_conditions?: Json
          allowed_states?: string[] | null
          created_at?: string
          id?: string
          max_loan_amount?: number | null
          max_ltv?: number | null
          min_fico?: number | null
          min_loan_amount?: number | null
          product_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string | null
          deactivated_at: string | null
          deactivated_by: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_by?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_lock_history: {
        Row: {
          action_type: string
          extension_days: number | null
          id: string
          loan_id: string
          metadata: Json
          new_rate: number | null
          notes: string | null
          performed_at: string
          performed_by: string | null
          previous_rate: number | null
          rate_lock_id: string
        }
        Insert: {
          action_type: string
          extension_days?: number | null
          id?: string
          loan_id: string
          metadata?: Json
          new_rate?: number | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_rate?: number | null
          rate_lock_id: string
        }
        Update: {
          action_type?: string
          extension_days?: number | null
          id?: string
          loan_id?: string
          metadata?: Json
          new_rate?: number | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          previous_rate?: number | null
          rate_lock_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_lock_history_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_lock_history_rate_lock_id_fkey"
            columns: ["rate_lock_id"]
            isOneToOne: false
            referencedRelation: "rate_locks"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_locks: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          investor_code: string | null
          loan_id: string
          lock_date: string
          lock_expiration: string
          lock_term_days: number | null
          locked_by_user_id: string | null
          locked_rate: number | null
          metadata: Json
          price_at_lock: number | null
          product_name: string | null
          rate_sheet_id: string | null
          source: string
          status: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          investor_code?: string | null
          loan_id: string
          lock_date?: string
          lock_expiration: string
          lock_term_days?: number | null
          locked_by_user_id?: string | null
          locked_rate?: number | null
          metadata?: Json
          price_at_lock?: number | null
          product_name?: string | null
          rate_sheet_id?: string | null
          source?: string
          status?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          investor_code?: string | null
          loan_id?: string
          lock_date?: string
          lock_expiration?: string
          lock_term_days?: number | null
          locked_by_user_id?: string | null
          locked_rate?: number | null
          metadata?: Json
          price_at_lock?: number | null
          product_name?: string | null
          rate_sheet_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_locks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_locks_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rate_locks_rate_sheet_id_fkey"
            columns: ["rate_sheet_id"]
            isOneToOne: false
            referencedRelation: "rate_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_sheet_datastores: {
        Row: {
          connection_type: string
          created_at: string
          created_by: string | null
          id: string
          integration_notes: string | null
          provider_name: string
          status: string
        }
        Insert: {
          connection_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          integration_notes?: string | null
          provider_name: string
          status?: string
        }
        Update: {
          connection_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          integration_notes?: string | null
          provider_name?: string
          status?: string
        }
        Relationships: []
      }
      rate_sheet_products: {
        Row: {
          created_at: string
          id: string
          loan_type: string | null
          max_loan_amount: number | null
          max_ltv: number | null
          min_credit_score: number | null
          min_loan_amount: number | null
          points: number | null
          price: number | null
          product_name: string
          rate: number
          rate_sheet_id: string
          state: string
        }
        Insert: {
          created_at?: string
          id?: string
          loan_type?: string | null
          max_loan_amount?: number | null
          max_ltv?: number | null
          min_credit_score?: number | null
          min_loan_amount?: number | null
          points?: number | null
          price?: number | null
          product_name: string
          rate: number
          rate_sheet_id: string
          state: string
        }
        Update: {
          created_at?: string
          id?: string
          loan_type?: string | null
          max_loan_amount?: number | null
          max_ltv?: number | null
          min_credit_score?: number | null
          min_loan_amount?: number | null
          points?: number | null
          price?: number | null
          product_name?: string
          rate?: number
          rate_sheet_id?: string
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_sheet_products_rate_sheet_id_fkey"
            columns: ["rate_sheet_id"]
            isOneToOne: false
            referencedRelation: "rate_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_sheets: {
        Row: {
          created_at: string
          created_by: string | null
          datastore_source_id: string | null
          effective_date: string | null
          expiration_date: string | null
          id: string
          metadata: Json
          name: string
          source_type: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          datastore_source_id?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          metadata?: Json
          name: string
          source_type: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          datastore_source_id?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          metadata?: Json
          name?: string
          source_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_sheets_datastore_source_id_fkey"
            columns: ["datastore_source_id"]
            isOneToOne: false
            referencedRelation: "rate_sheet_datastores"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_system: boolean | null
          name: string
          permissions: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_system?: boolean | null
          name: string
          permissions?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_system?: boolean | null
          name?: string
          permissions?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sla_configurations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          from_status: string | null
          id: string
          is_active: boolean
          name: string
          scope: string
          severity: string
          target_hours: number
          to_status: string | null
          updated_at: string
          warning_hours: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          from_status?: string | null
          id?: string
          is_active?: boolean
          name: string
          scope: string
          severity?: string
          target_hours: number
          to_status?: string | null
          updated_at?: string
          warning_hours?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          from_status?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scope?: string
          severity?: string
          target_hours?: number
          to_status?: string | null
          updated_at?: string
          warning_hours?: number | null
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          comment_id: string
          comment_text: string
          created_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          comment_id?: string
          comment_text: string
          created_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          comment_id?: string
          comment_text?: string
          created_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "action_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          meeting_id: string | null
          metadata: Json | null
          priority: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          metadata?: Json | null
          priority?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          meeting_id?: string | null
          metadata?: Json | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_settings: {
        Row: {
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          custom_role_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          custom_role_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      hedge_assumptions_versions: {
        Row: {
          assumptions: Json
          created_at: string
          effective_date: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          assumptions?: Json
          created_at?: string
          effective_date?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Update: {
          assumptions?: Json
          created_at?: string
          effective_date?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      hedge_pipeline_snapshots: {
        Row: {
          active_lock_count: number | null
          assumptions_snapshot: Json | null
          computed_by: string | null
          created_at: string
          id: string
          locked_volume: number | null
          optional_symbol: string | null
          snapshot_date: string
          totals: Json
        }
        Insert: {
          active_lock_count?: number | null
          assumptions_snapshot?: Json | null
          computed_by?: string | null
          created_at?: string
          id?: string
          locked_volume?: number | null
          optional_symbol?: string | null
          snapshot_date?: string
          totals?: Json
        }
        Update: {
          active_lock_count?: number | null
          assumptions_snapshot?: Json | null
          computed_by?: string | null
          created_at?: string
          id?: string
          locked_volume?: number | null
          optional_symbol?: string | null
          snapshot_date?: string
          totals?: Json
        }
        Relationships: []
      }
      investor_submissions: {
        Row: {
          cleared_at: string | null
          created_at: string
          created_by: string | null
          id: string
          investor_code: string
          loan_id: string
          metadata: Json
          notes: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          cleared_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          investor_code?: string
          loan_id: string
          metadata?: Json
          notes?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          cleared_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          investor_code?: string
          loan_id?: string
          metadata?: Json
          notes?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_submissions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_pricing_snapshots: {
        Row: {
          best_execution: boolean
          computed_at: string
          computed_by: string | null
          id: string
          loan_id: string
          raw_summary: Json
          results_count: number | null
          scenario_dims: Json | null
          winner_investor_code: string | null
          winner_price: number | null
          winner_product_name: string | null
          winner_quote_type: string | null
          winner_rate: number | null
        }
        Insert: {
          best_execution?: boolean
          computed_at?: string
          computed_by?: string | null
          id?: string
          loan_id: string
          raw_summary?: Json
          results_count?: number | null
          scenario_dims?: Json
          winner_investor_code?: string | null
          winner_price?: number | null
          winner_product_name?: string | null
          winner_quote_type?: string | null
          winner_rate?: number | null
        }
        Update: {
          best_execution?: boolean
          computed_at?: string
          computed_by?: string | null
          id?: string
          loan_id?: string
          raw_summary?: Json
          results_count?: number | null
          scenario_dims?: Json
          winner_investor_code?: string | null
          winner_price?: number | null
          winner_product_name?: string | null
          winner_quote_type?: string | null
          winner_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_pricing_snapshots_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      activity_logs_with_users: {
        Row: {
          action: string | null
          created_at: string | null
          details: Json | null
          id: string | null
          ip_address: unknown
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_avatar: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
        }
        Relationships: []
      }
      admin_statistics: {
        Row: {
          stats: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_admin_stats: { Args: never; Returns: Json }
      get_my_role: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_edge_function_invocation: {
        Args: { function_name: string }
        Returns: undefined
      }
      is_branch_manager: { Args: { _user_id: string }; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_details?: Json
          p_ip_address?: unknown
          p_resource_id?: string
          p_resource_type?: string
          p_user_agent?: string
        }
        Returns: string
      }
      mask_api_key: { Args: { api_key: string }; Returns: string }
      user_branch_id: { Args: { _user_id: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
