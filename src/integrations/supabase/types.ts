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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campaign_participants: {
        Row: {
          campaign_id: string
          cpf: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          played: boolean
          source: string
          spun_at: string | null
          spun_prize_id: string | null
          token_used_at: string | null
          unique_token: string
        }
        Insert: {
          campaign_id: string
          cpf?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          played?: boolean
          source?: string
          spun_at?: string | null
          spun_prize_id?: string | null
          token_used_at?: string | null
          unique_token?: string
        }
        Update: {
          campaign_id?: string
          cpf?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          played?: boolean
          source?: string
          spun_at?: string | null
          spun_prize_id?: string | null
          token_used_at?: string | null
          unique_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_participants_spun_prize_id_fkey"
            columns: ["spun_prize_id"]
            isOneToOne: false
            referencedRelation: "prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_spins: {
        Row: {
          campaign_id: string
          id: string
          lead_ref: string
          prize_id: string
          spun_at: string
        }
        Insert: {
          campaign_id: string
          id?: string
          lead_ref: string
          prize_id: string
          spun_at?: string
        }
        Update: {
          campaign_id?: string
          id?: string
          lead_ref?: string
          prize_id?: string
          spun_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_spins_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_spins_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active: boolean
          campaign_type: string
          created_at: string
          discount_percentage: number
          end_date: string
          has_participant_list: boolean
          id: string
          is_test: boolean
          mechanic: string
          name: string
          participation_limit: number | null
          rules: string
          slug: string
          start_date: string
        }
        Insert: {
          active?: boolean
          campaign_type?: string
          created_at?: string
          discount_percentage?: number
          end_date?: string
          has_participant_list?: boolean
          id?: string
          is_test?: boolean
          mechanic?: string
          name: string
          participation_limit?: number | null
          rules?: string
          slug: string
          start_date?: string
        }
        Update: {
          active?: boolean
          campaign_type?: string
          created_at?: string
          discount_percentage?: number
          end_date?: string
          has_participant_list?: boolean
          id?: string
          is_test?: boolean
          mechanic?: string
          name?: string
          participation_limit?: number | null
          rules?: string
          slug?: string
          start_date?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          brevo_contact_id: string | null
          brevo_error: string | null
          brevo_last_sync_at: string | null
          brevo_sync_status: string
          campanha: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          merged_by_phone: boolean
          origem: string
          pagina: string | null
          updated_at: string
          whatsapp_e164: string
          whatsapp_raw: string
        }
        Insert: {
          brevo_contact_id?: string | null
          brevo_error?: string | null
          brevo_last_sync_at?: string | null
          brevo_sync_status?: string
          campanha?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          merged_by_phone?: boolean
          origem?: string
          pagina?: string | null
          updated_at?: string
          whatsapp_e164: string
          whatsapp_raw: string
        }
        Update: {
          brevo_contact_id?: string | null
          brevo_error?: string | null
          brevo_last_sync_at?: string | null
          brevo_sync_status?: string
          campanha?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          merged_by_phone?: boolean
          origem?: string
          pagina?: string | null
          updated_at?: string
          whatsapp_e164?: string
          whatsapp_raw?: string
        }
        Relationships: []
      }
      participations: {
        Row: {
          campaign_id: string | null
          cpf: string | null
          email: string
          id: string
          name: string
          played_at: string
          prize_id: string
          whatsapp: string
        }
        Insert: {
          campaign_id?: string | null
          cpf?: string | null
          email: string
          id?: string
          name: string
          played_at?: string
          prize_id: string
          whatsapp: string
        }
        Update: {
          campaign_id?: string | null
          cpf?: string | null
          email?: string
          id?: string
          name?: string
          played_at?: string
          prize_id?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "participations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participations_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      prizes: {
        Row: {
          active: boolean
          campaign_id: string | null
          checkout_url: string | null
          color_token: string | null
          created_at: string
          description: string
          display_order: number
          emoji: string
          id: string
          image_url: string
          is_consolation: boolean
          name: string
          probability: number
          quantity_available: number | null
          quantity_distributed: number
          redeem_instructions: string
          show_image: boolean
          weight: number
        }
        Insert: {
          active?: boolean
          campaign_id?: string | null
          checkout_url?: string | null
          color_token?: string | null
          created_at?: string
          description?: string
          display_order?: number
          emoji?: string
          id?: string
          image_url?: string
          is_consolation?: boolean
          name: string
          probability?: number
          quantity_available?: number | null
          quantity_distributed?: number
          redeem_instructions?: string
          show_image?: boolean
          weight?: number
        }
        Update: {
          active?: boolean
          campaign_id?: string | null
          checkout_url?: string | null
          color_token?: string | null
          created_at?: string
          description?: string
          display_order?: number
          emoji?: string
          id?: string
          image_url?: string
          is_consolation?: boolean
          name?: string
          probability?: number
          quantity_available?: number | null
          quantity_distributed?: number
          redeem_instructions?: string
          show_image?: boolean
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "prizes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_participation_token: { Args: { p_token: string }; Returns: Json }
      get_campaign_prizes: {
        Args: { p_campaign: string }
        Returns: {
          checkout_url: string
          color_token: string
          description: string
          display_order: number
          emoji: string
          id: string
          image_url: string
          is_consolation: boolean
          name: string
          probability: number
          redeem_instructions: string
        }[]
      }
      get_token_preview: { Args: { p_token: string }; Returns: Json }
      get_wheel_segments: {
        Args: { p_campaign: string }
        Returns: {
          color_token: string
          display_order: number
          emoji: string
          id: string
          image_url: string
          is_consolation: boolean
          label: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_participant_played: {
        Args: { p_participant_id: string }
        Returns: undefined
      }
      update_participant_contact: {
        Args: {
          p_email: string
          p_name: string
          p_participant_id: string
          p_phone: string
        }
        Returns: undefined
      }
      validate_list_participant: {
        Args: { p_campaign_id: string; p_email: string; p_phone?: string }
        Returns: Json
      }
      validate_token_and_participant: {
        Args: {
          p_email: string
          p_name: string
          p_phone: string
          p_token: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
