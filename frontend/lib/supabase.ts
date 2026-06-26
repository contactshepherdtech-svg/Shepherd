import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Database = {
  public: {
    Tables: {
      churches: {
        Row: {
          id: number;
          name: string | null;
          planning_center_org_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          name?: string | null;
          planning_center_org_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          name?: string | null;
          planning_center_org_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: number;
          church_id: number | null;
          pco_id: string | null;
          name: string | null;
          email: string | null;
          status: string | null;
          source: string | null;
          pco_created_at: string | null;
          first_visit_date: string | null;
          visitor_status: string | null;
          member_lifecycle: string | null;
          last_followup_at: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          church_id?: number | null;
          pco_id?: string | null;
          name?: string | null;
          email?: string | null;
          status?: string | null;
          source?: string | null;
          pco_created_at?: string | null;
          first_visit_date?: string | null;
          visitor_status?: string | null;
          member_lifecycle?: string | null;
          last_followup_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          church_id?: number | null;
          pco_id?: string | null;
          name?: string | null;
          email?: string | null;
          status?: string | null;
          source?: string | null;
          pco_created_at?: string | null;
          first_visit_date?: string | null;
          visitor_status?: string | null;
          member_lifecycle?: string | null;
          last_followup_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
      };
      attendance: {
        Row: {
          id: number;
          church_id: number | null;
          pco_checkin_id: string | null;
          member_pco_id: string | null;
          attended_at: string | null;
          source: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          church_id?: number | null;
          pco_checkin_id?: string | null;
          member_pco_id?: string | null;
          attended_at?: string | null;
          source?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          church_id?: number | null;
          pco_checkin_id?: string | null;
          member_pco_id?: string | null;
          attended_at?: string | null;
          source?: string | null;
          created_at?: string | null;
        };
      };
      risk_scores: {
        Row: {
          id: number;
          church_id: number | null;
          member_pco_id: string | null;
          score: number | null;
          tier: string | null;
          reasons: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          church_id?: number | null;
          member_pco_id?: string | null;
          score?: number | null;
          tier?: string | null;
          reasons?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          church_id?: number | null;
          member_pco_id?: string | null;
          score?: number | null;
          tier?: string | null;
          reasons?: string | null;
          updated_at?: string | null;
        };
      };
      church_settings: {
        Row: {
          id: number;
          church_id: number | null;
          church_name: string | null;
          main_service_frequency: string | null;
          watch_missed_services: number | null;
          at_risk_missed_services: number | null;
          critical_missed_services: number | null;
          small_groups_enabled: boolean | null;
          small_group_frequency: string | null;
          volunteer_tracking_enabled: boolean | null;
          volunteer_importance: string | null;
          giving_enabled: boolean | null;
          email_engagement_enabled: boolean | null;
          preferred_followup_style: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          church_id?: number | null;
          church_name?: string | null;
          main_service_frequency?: string | null;
          watch_missed_services?: number | null;
          at_risk_missed_services?: number | null;
          critical_missed_services?: number | null;
          small_groups_enabled?: boolean | null;
          small_group_frequency?: string | null;
          volunteer_tracking_enabled?: boolean | null;
          volunteer_importance?: string | null;
          giving_enabled?: boolean | null;
          email_engagement_enabled?: boolean | null;
          preferred_followup_style?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          church_id?: number | null;
          church_name?: string | null;
          main_service_frequency?: string | null;
          watch_missed_services?: number | null;
          at_risk_missed_services?: number | null;
          critical_missed_services?: number | null;
          small_groups_enabled?: boolean | null;
          small_group_frequency?: string | null;
          volunteer_tracking_enabled?: boolean | null;
          volunteer_importance?: string | null;
          giving_enabled?: boolean | null;
          email_engagement_enabled?: boolean | null;
          preferred_followup_style?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      integration_tokens: {
        Row: {
          id: number;
          church_id: number | null;
          provider: string | null;
          access_token: string | null;
          refresh_token: string | null;
          expires_at: string | null;
          scope: string | null;
          connection_status: string | null;
          connected_email: string | null;
          last_sync_at: string | null;
          members_imported: number | null;
          attendance_imported: number | null;
          sync_status: string | null;
          sync_started_at: string | null;
          sync_error: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          church_id?: number | null;
          provider?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          scope?: string | null;
          connection_status?: string | null;
          connected_email?: string | null;
          last_sync_at?: string | null;
          members_imported?: number | null;
          attendance_imported?: number | null;
          sync_status?: string | null;
          sync_started_at?: string | null;
          sync_error?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          church_id?: number | null;
          provider?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          expires_at?: string | null;
          scope?: string | null;
          connection_status?: string | null;
          connected_email?: string | null;
          last_sync_at?: string | null;
          members_imported?: number | null;
          attendance_imported?: number | null;
          sync_status?: string | null;
          sync_started_at?: string | null;
          sync_error?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      church_users: {
        Row: {
          id: number;
          user_id: string;
          church_id: number;
          role: string;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          user_id: string;
          church_id: number;
          role?: string;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          user_id?: string;
          church_id?: number;
          role?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      outreach_status: {
        Row: {
          id: number;
          church_id: number | null;
          member_pco_id: string;
          status: string;
          workflow_status: string;
          contacted_at: string | null;
          snoozed_until: string | null;
          notes: string | null;
          draft_created_at: string | null;
          gmail_draft_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          church_id?: number | null;
          member_pco_id: string;
          status?: string;
          workflow_status?: string;
          contacted_at?: string | null;
          snoozed_until?: string | null;
          notes?: string | null;
          draft_created_at?: string | null;
          gmail_draft_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          church_id?: number | null;
          member_pco_id?: string;
          status?: string;
          workflow_status?: string;
          contacted_at?: string | null;
          snoozed_until?: string | null;
          notes?: string | null;
          draft_created_at?: string | null;
          gmail_draft_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      sync_history: {
        Row: {
          id: number;
          church_id: number;
          status: string;
          members_imported: number | null;
          attendance_imported: number | null;
          risk_scores_updated: number | null;
          lifecycle_updated: number | null;
          error_message: string | null;
          started_at: string | null;
          finished_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          church_id: number;
          status: string;
          members_imported?: number | null;
          attendance_imported?: number | null;
          risk_scores_updated?: number | null;
          lifecycle_updated?: number | null;
          error_message?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          church_id?: number;
          status?: string;
          members_imported?: number | null;
          attendance_imported?: number | null;
          risk_scores_updated?: number | null;
          lifecycle_updated?: number | null;
          error_message?: string | null;
          started_at?: string | null;
          finished_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      church_invitations: {
        Row: {
          id: number;
          church_id: number;
          email: string;
          role: string;
          status: string;
          invited_by: string | null;
          invited_user_id: string | null;
          token: string;
          created_at: string | null;
          expires_at: string | null;
          accepted_at: string | null;
        };
        Insert: {
          id?: number;
          church_id: number;
          email: string;
          role: string;
          status?: string;
          invited_by?: string | null;
          invited_user_id?: string | null;
          token?: string;
          created_at?: string | null;
          expires_at?: string | null;
          accepted_at?: string | null;
        };
        Update: {
          id?: number;
          church_id?: number;
          email?: string;
          role?: string;
          status?: string;
          invited_by?: string | null;
          invited_user_id?: string | null;
          token?: string;
          created_at?: string | null;
          expires_at?: string | null;
          accepted_at?: string | null;
        };
        Relationships: [];
      };
      assignments: {
        Row: {
          id: number;
          church_id: number;
          member_id: number;
          owner_user_id: string | null;
          due_date: string | null;
          done: boolean;
          done_at: string | null;
          created_by: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          church_id: number;
          member_id: number;
          owner_user_id?: string | null;
          due_date?: string | null;
          done?: boolean;
          done_at?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          church_id?: number;
          member_id?: number;
          owner_user_id?: string | null;
          due_date?: string | null;
          done?: boolean;
          done_at?: string | null;
          created_by?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      // T2 note, isolated in its own table so RLS gates note visibility at the ROW
      // level (viewers get zero rows). Keyed 1:1 to assignments by assignment_id.
      assignment_notes: {
        Row: {
          assignment_id: number;
          church_id: number;
          note: string | null;
          updated_at: string | null;
        };
        Insert: {
          assignment_id: number;
          church_id: number;
          note?: string | null;
          updated_at?: string | null;
        };
        Update: {
          assignment_id?: number;
          church_id?: number;
          note?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      integration_status: {
        // Token-free, church-scoped VIEW over integration_tokens (migration: integration_status).
        // The access_token / refresh_token columns are intentionally absent; presence is
        // exposed only as has_access_token / has_refresh_token booleans. Select-only.
        Row: {
          id: number | null;
          church_id: number | null;
          provider: string | null;
          connection_status: string | null;
          connected_email: string | null;
          expires_at: string | null;
          scope: string | null;
          last_sync_at: string | null;
          members_imported: number | null;
          attendance_imported: number | null;
          sync_status: string | null;
          sync_started_at: string | null;
          sync_error: string | null;
          created_at: string | null;
          updated_at: string | null;
          has_access_token: boolean | null;
          has_refresh_token: boolean | null;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
    };
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cachedClient: SupabaseClient<Database> | null = null;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!hasSupabaseEnv) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return cachedClient;
}

export const supabase = getSupabaseClient();
