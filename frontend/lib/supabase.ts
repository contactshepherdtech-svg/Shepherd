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
          contacted_at: string | null;
          snoozed_until: string | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: number;
          church_id?: number | null;
          member_pco_id: string;
          status?: string;
          contacted_at?: string | null;
          snoozed_until?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: number;
          church_id?: number | null;
          member_pco_id?: string;
          status?: string;
          contacted_at?: string | null;
          snoozed_until?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
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
