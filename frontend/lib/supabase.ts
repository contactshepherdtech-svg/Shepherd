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
          created_at: string | null;
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
          last_sync_at: string | null;
          members_imported: number | null;
          attendance_imported: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
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
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedClient;
}

export const supabase = getSupabaseClient();
