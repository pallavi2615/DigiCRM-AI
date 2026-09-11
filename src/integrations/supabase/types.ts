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
      activities: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          base_amount: number
          commission_amount: number
          commission_pct: number
          created_at: string
          id: string
          lead_id: string | null
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          base_amount?: number
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          base_amount?: number
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          lead_id?: string | null
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payout_requests: {
        Row: {
          affiliate_id: string
          amount: number
          approved_at: string | null
          created_at: string
          decision_reason: string | null
          id: string
          method: string
          notes: string | null
          paid_at: string | null
          processed_at: string | null
          processed_by: string | null
          reference: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          approved_at?: string | null
          created_at?: string
          decision_reason?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          approved_at?: string | null
          created_at?: string
          decision_reason?: string | null
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reference?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payout_requests_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payout_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payout_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_settings: {
        Row: {
          cookie_days: number
          created_at: string
          default_commission_pct: number
          id: string
          payout_terms: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cookie_days?: number
          created_at?: string
          default_commission_pct?: number
          id?: string
          payout_terms?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cookie_days?: number
          created_at?: string
          default_commission_pct?: number
          id?: string
          payout_terms?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      affiliates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audience: string | null
          channels: string | null
          commission_pct: number
          company: string | null
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          payout_method: string | null
          referral_code: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string | null
          channels?: string | null
          commission_pct?: number
          company?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          payout_method?: string | null
          referral_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audience?: string | null
          channels?: string | null
          commission_pct?: number
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          payout_method?: string | null
          referral_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          group_slug: string | null
          id: string
          model: string | null
          pack_slug: string | null
          prompt_chars: number
          response_chars: number
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          group_slug?: string | null
          id?: string
          model?: string | null
          pack_slug?: string | null
          prompt_chars?: number
          response_chars?: number
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          group_slug?: string | null
          id?: string
          model?: string | null
          pack_slug?: string | null
          prompt_chars?: number
          response_chars?: number
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          id: string
          is_enabled: boolean
          name: string
          tenant_id: string | null
          trigger: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
          tenant_id?: string | null
          trigger: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
          tenant_id?: string | null
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      canned_responses: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "canned_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canned_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_campaigns: {
        Row: {
          active: boolean
          benefits: Json
          created_at: string
          cta_label: string
          ends_at: string | null
          form_fields: Json
          headline: string
          hero_image: string | null
          id: string
          slug: string
          starts_at: string | null
          subhead: string | null
          thank_you_message: string
          theme: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          benefits?: Json
          created_at?: string
          cta_label?: string
          ends_at?: string | null
          form_fields?: Json
          headline: string
          hero_image?: string | null
          id?: string
          slug: string
          starts_at?: string | null
          subhead?: string | null
          thank_you_message?: string
          theme?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          benefits?: Json
          created_at?: string
          cta_label?: string
          ends_at?: string | null
          form_fields?: Json
          headline?: string
          hero_image?: string | null
          id?: string
          slug?: string
          starts_at?: string | null
          subhead?: string | null
          thank_you_message?: string
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_home_slides: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string | null
          cta_url: string | null
          headline: string
          id: string
          image_url: string | null
          sort_order: number
          subhead: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          headline: string
          id?: string
          image_url?: string | null
          sort_order?: number
          subhead?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          headline?: string
          id?: string
          image_url?: string | null
          sort_order?: number
          subhead?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cms_menu_items: {
        Row: {
          active: boolean
          created_at: string
          group_label: string | null
          id: string
          label: string
          location: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_label?: string | null
          id?: string
          label: string
          location: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          group_label?: string | null
          id?: string
          label?: string
          location?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      cms_pages: {
        Row: {
          body: Json
          canonical_override: string | null
          created_at: string
          created_by: string | null
          hero: Json
          id: string
          meta_description: string | null
          noindex: boolean
          og_image: string | null
          published_at: string | null
          seo_keywords: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: Json
          canonical_override?: string | null
          created_at?: string
          created_by?: string | null
          hero?: Json
          id?: string
          meta_description?: string | null
          noindex?: boolean
          og_image?: string | null
          published_at?: string | null
          seo_keywords?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json
          canonical_override?: string | null
          created_at?: string
          created_by?: string | null
          hero?: Json
          id?: string
          meta_description?: string | null
          noindex?: boolean
          og_image?: string | null
          published_at?: string | null
          seo_keywords?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_posts: {
        Row: {
          author_id: string | null
          author_name: string | null
          body: string
          cover_image: string | null
          created_at: string
          excerpt: string | null
          id: string
          og_image: string | null
          published_at: string | null
          reading_minutes: number
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          og_image?: string | null
          published_at?: string | null
          reading_minutes?: number
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          body?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          og_image?: string | null
          published_at?: string | null
          reading_minutes?: number
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_seo_settings: {
        Row: {
          default_description: string
          default_og_image: string | null
          default_title: string
          ga_id: string | null
          gtm_id: string | null
          id: string
          meta_pixel_id: string | null
          robots_default: string
          site_name: string
          twitter_handle: string | null
          updated_at: string
        }
        Insert: {
          default_description?: string
          default_og_image?: string | null
          default_title?: string
          ga_id?: string | null
          gtm_id?: string | null
          id: string
          meta_pixel_id?: string | null
          robots_default?: string
          site_name?: string
          twitter_handle?: string | null
          updated_at?: string
        }
        Update: {
          default_description?: string
          default_og_image?: string | null
          default_title?: string
          ga_id?: string | null
          gtm_id?: string | null
          id?: string
          meta_pixel_id?: string | null
          robots_default?: string
          site_name?: string
          twitter_handle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          annual_revenue: number | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          employee_count: number | null
          gst_number: string | null
          id: string
          industry: string | null
          industry_group: string | null
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          tenant_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          annual_revenue?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          employee_count?: number | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          industry_group?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          annual_revenue?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          employee_count?: number | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          industry_group?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          company: string | null
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string | null
          name: string
          phone: string | null
          source: string
          updated_at: string
          utm: Json
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          source?: string
          updated_at?: string
          utm?: Json
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          source?: string
          updated_at?: string
          utm?: Json
        }
        Relationships: []
      }
      contacts: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          designation: string | null
          email: string | null
          first_name: string
          id: string
          industry_group: string | null
          last_name: string | null
          notes: string | null
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          designation?: string | null
          email?: string | null
          first_name: string
          id?: string
          industry_group?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          designation?: string | null
          email?: string | null
          first_name?: string
          id?: string
          industry_group?: string | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_layouts: {
        Row: {
          created_at: string
          hidden_widgets: string[]
          layout: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_widgets?: string[]
          layout?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_widgets?: string[]
          layout?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inbound_webhooks_log: {
        Row: {
          attempts: number
          attempts_log: Json
          created_at: string
          dead_letter: boolean
          event_id: string | null
          id: string
          last_error: string | null
          message: string | null
          next_retry_at: string | null
          ok: boolean
          payload: Json | null
          source: string
          status_code: number
          tenant_id: string | null
        }
        Insert: {
          attempts?: number
          attempts_log?: Json
          created_at?: string
          dead_letter?: boolean
          event_id?: string | null
          id?: string
          last_error?: string | null
          message?: string | null
          next_retry_at?: string | null
          ok: boolean
          payload?: Json | null
          source: string
          status_code: number
          tenant_id?: string | null
        }
        Update: {
          attempts?: number
          attempts_log?: Json
          created_at?: string
          dead_letter?: boolean
          event_id?: string | null
          id?: string
          last_error?: string | null
          message?: string | null
          next_retry_at?: string | null
          ok?: boolean
          payload?: Json | null
          source?: string
          status_code?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_webhooks_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_webhooks_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      it_projects: {
        Row: {
          budget: number | null
          client_email: string | null
          client_name: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          manager_id: string | null
          name: string
          owner_id: string | null
          stage: string
          start_date: string | null
          tech_stack: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          budget?: number | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          manager_id?: string | null
          name: string
          owner_id?: string | null
          stage?: string
          start_date?: string | null
          tech_stack?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          budget?: number | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          owner_id?: string | null
          stage?: string
          start_date?: string | null
          tech_stack?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: []
      }
      it_tickets: {
        Row: {
          assignee_id: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          owner_id: string | null
          priority: string | null
          project_id: string | null
          resolved_at: string | null
          status: string | null
          ticket_type: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          priority?: string | null
          project_id?: string | null
          resolved_at?: string | null
          status?: string | null
          ticket_type?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          priority?: string | null
          project_id?: string | null
          resolved_at?: string | null
          status?: string | null
          ticket_type?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "it_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "it_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_type: string
          id: string
          page_slug: string
          referrer: string | null
          session_id: string | null
          source: string | null
          tenant_id: string
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_type: string
          id?: string
          page_slug?: string
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          tenant_id: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_type?: string
          id?: string
          page_slug?: string
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          tenant_id?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_page_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_page_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_campaigns: {
        Row: {
          budget: number | null
          channel_id: string | null
          code: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          is_active: boolean
          name: string
          starts_on: string | null
          tenant_id: string | null
        }
        Insert: {
          budget?: number | null
          channel_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name: string
          starts_on?: string | null
          tenant_id?: string | null
        }
        Update: {
          budget?: number | null
          channel_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          name?: string
          starts_on?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_campaigns_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "lead_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_channels: {
        Row: {
          created_at: string
          created_by: string | null
          default_group_slug: string | null
          default_pack_slug: string | null
          id: string
          is_active: boolean
          kind: string
          monthly_cost: number | null
          name: string
          slug: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_group_slug?: string | null
          default_pack_slug?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          monthly_cost?: number | null
          name: string
          slug: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_group_slug?: string | null
          default_pack_slug?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          monthly_cost?: number | null
          name?: string
          slug?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_channels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_conversions: {
        Row: {
          campaign_id: string | null
          channel_id: string | null
          created_at: string
          group_slug: string | null
          id: string
          industry_group: string | null
          lead_id: string | null
          occurred_at: string
          pack_record_id: string | null
          pack_slug: string | null
          revenue: number
          stage: string
          status: string
          tenant_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel_id?: string | null
          created_at?: string
          group_slug?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          occurred_at?: string
          pack_record_id?: string | null
          pack_slug?: string | null
          revenue?: number
          stage?: string
          status?: string
          tenant_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel_id?: string | null
          created_at?: string
          group_slug?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          occurred_at?: string
          pack_record_id?: string | null
          pack_slug?: string | null
          revenue?: number
          stage?: string
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_conversions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "lead_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversions_pack_record_id_fkey"
            columns: ["pack_record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          affiliate_id: string | null
          alternate_phone: string | null
          assigned_to: string | null
          campaign: string | null
          campaign_id: string | null
          channel_id: string | null
          city: string | null
          company_id: string | null
          company_name: string
          contact_id: string | null
          contact_person: string | null
          converted_at: string | null
          country: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          designation: string | null
          email: string | null
          estimated_value: number | null
          expected_close_date: string | null
          external_ref: string | null
          id: string
          industry: string | null
          industry_group: string | null
          notes: string | null
          phone: string | null
          priority: Database["public"]["Enums"]["lead_priority"]
          source: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[] | null
          tenant_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          affiliate_id?: string | null
          alternate_phone?: string | null
          assigned_to?: string | null
          campaign?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          city?: string | null
          company_id?: string | null
          company_name: string
          contact_id?: string | null
          contact_person?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          designation?: string | null
          email?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          external_ref?: string | null
          id?: string
          industry?: string | null
          industry_group?: string | null
          notes?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          affiliate_id?: string | null
          alternate_phone?: string | null
          assigned_to?: string | null
          campaign?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string
          contact_id?: string | null
          contact_person?: string | null
          converted_at?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          designation?: string | null
          email?: string | null
          estimated_value?: number | null
          expected_close_date?: string | null
          external_ref?: string | null
          id?: string
          industry?: string | null
          industry_group?: string | null
          notes?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["lead_priority"]
          source?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          tenant_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "lead_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lenders: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          lender_type: string
          logo_url: string | null
          name: string
          notes: string | null
          payout_pct: number | null
          processing_fee_pct: number | null
          roi_max: number | null
          roi_min: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          lender_type?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          payout_pct?: number | null
          processing_fee_pct?: number | null
          roi_max?: number | null
          roi_min?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          lender_type?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          payout_pct?: number | null
          processing_fee_pct?: number | null
          roi_max?: number | null
          roi_min?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      loan_applications: {
        Row: {
          applicant_name: string
          assigned_to: string | null
          city: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          deleted_at: string | null
          disbursed_amount: number | null
          disbursed_at: string | null
          email: string | null
          emi: number | null
          employer_name: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          existing_emi: number | null
          id: string
          lender_id: string | null
          loan_product_id: string | null
          loan_type: Database["public"]["Enums"]["loan_type"]
          monthly_income: number | null
          notes: string | null
          pan: string | null
          phone: string | null
          purpose: string | null
          rejection_reason: string | null
          requested_amount: number
          roi: number | null
          sanctioned_amount: number | null
          source: string | null
          stage: Database["public"]["Enums"]["loan_stage"]
          tenure_months: number | null
          updated_at: string
        }
        Insert: {
          applicant_name: string
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          disbursed_amount?: number | null
          disbursed_at?: string | null
          email?: string | null
          emi?: number | null
          employer_name?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          existing_emi?: number | null
          id?: string
          lender_id?: string | null
          loan_product_id?: string | null
          loan_type: Database["public"]["Enums"]["loan_type"]
          monthly_income?: number | null
          notes?: string | null
          pan?: string | null
          phone?: string | null
          purpose?: string | null
          rejection_reason?: string | null
          requested_amount: number
          roi?: number | null
          sanctioned_amount?: number | null
          source?: string | null
          stage?: Database["public"]["Enums"]["loan_stage"]
          tenure_months?: number | null
          updated_at?: string
        }
        Update: {
          applicant_name?: string
          assigned_to?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          disbursed_amount?: number | null
          disbursed_at?: string | null
          email?: string | null
          emi?: number | null
          employer_name?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          existing_emi?: number | null
          id?: string
          lender_id?: string | null
          loan_product_id?: string | null
          loan_type?: Database["public"]["Enums"]["loan_type"]
          monthly_income?: number | null
          notes?: string | null
          pan?: string | null
          phone?: string | null
          purpose?: string | null
          rejection_reason?: string | null
          requested_amount?: number
          roi?: number | null
          sanctioned_amount?: number | null
          source?: string | null
          stage?: Database["public"]["Enums"]["loan_stage"]
          tenure_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_applications_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_applications_loan_product_id_fkey"
            columns: ["loan_product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_commissions: {
        Row: {
          agent_id: string | null
          application_id: string
          created_at: string
          disbursed_amount: number
          expected_amount: number
          id: string
          invoice_no: string | null
          lender_id: string | null
          notes: string | null
          payout_pct: number
          received_amount: number | null
          received_at: string | null
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          application_id: string
          created_at?: string
          disbursed_amount: number
          expected_amount: number
          id?: string
          invoice_no?: string | null
          lender_id?: string | null
          notes?: string | null
          payout_pct: number
          received_amount?: number | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          application_id?: string
          created_at?: string
          disbursed_amount?: number
          expected_amount?: number
          id?: string
          invoice_no?: string | null
          lender_id?: string | null
          notes?: string | null
          payout_pct?: number
          received_amount?: number | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_commissions_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_commissions_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_documents: {
        Row: {
          application_id: string
          created_at: string
          doc_type: Database["public"]["Enums"]["doc_type"]
          file_name: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          application_id: string
          created_at?: string
          doc_type: Database["public"]["Enums"]["doc_type"]
          file_name?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["doc_type"]
          file_name?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "loan_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_products: {
        Row: {
          active: boolean
          created_at: string
          id: string
          lender_id: string
          max_amount: number | null
          max_tenure_months: number | null
          min_amount: number | null
          min_tenure_months: number | null
          name: string
          payout_pct: number | null
          processing_fee_pct: number | null
          product_type: Database["public"]["Enums"]["loan_type"]
          roi_max: number | null
          roi_min: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          lender_id: string
          max_amount?: number | null
          max_tenure_months?: number | null
          min_amount?: number | null
          min_tenure_months?: number | null
          name: string
          payout_pct?: number | null
          processing_fee_pct?: number | null
          product_type: Database["public"]["Enums"]["loan_type"]
          roi_max?: number | null
          roi_min?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          lender_id?: string
          max_amount?: number | null
          max_tenure_months?: number | null
          min_amount?: number | null
          min_tenure_months?: number | null
          name?: string
          payout_pct?: number | null
          processing_fee_pct?: number | null
          product_type?: Database["public"]["Enums"]["loan_type"]
          roi_max?: number | null
          roi_min?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_products_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          contact_id: string | null
          created_at: string
          description: string | null
          ends_at: string
          id: string
          industry_group: string | null
          lead_id: string | null
          location: string | null
          meeting_url: string | null
          notes: string | null
          organizer: string | null
          participants: string[] | null
          starts_at: string
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          organizer?: string | null
          participants?: string[] | null
          starts_at: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          location?: string | null
          meeting_url?: string | null
          notes?: string | null
          organizer?: string | null
          participants?: string[] | null
          starts_at?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      module_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          kind: string
          label: string | null
          module_key: string
          sort_order: number
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          label?: string | null
          module_key: string
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          label?: string | null
          module_key?: string
          sort_order?: number
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "module_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pack_agent_runs: {
        Row: {
          agent_key: string
          created_at: string
          created_by: string | null
          group_slug: string
          id: string
          input: Json
          output: string | null
          pack_slug: string
          record_id: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          agent_key: string
          created_at?: string
          created_by?: string | null
          group_slug: string
          id?: string
          input?: Json
          output?: string | null
          pack_slug: string
          record_id?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          agent_key?: string
          created_at?: string
          created_by?: string | null
          group_slug?: string
          id?: string
          input?: Json
          output?: string | null
          pack_slug?: string
          record_id?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_agent_runs_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_agent_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_agent_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_ai_training: {
        Row: {
          created_at: string
          created_by: string | null
          examples: Json
          glossary: string | null
          group_slug: string
          id: string
          pack_slug: string
          tenant_id: string
          tone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          examples?: Json
          glossary?: string | null
          group_slug: string
          id?: string
          pack_slug: string
          tenant_id: string
          tone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          examples?: Json
          glossary?: string | null
          group_slug?: string
          id?: string
          pack_slug?: string
          tenant_id?: string
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_ai_training_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_ai_training_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_configs: {
        Row: {
          agents: Json | null
          archived_at: string | null
          created_at: string
          description: string | null
          fields: Json | null
          gradient: string | null
          group_slug: string
          id: string
          is_custom: boolean
          kpi_labels: Json | null
          lost_stages: Json | null
          name: string | null
          pack_slug: string
          party_label: string | null
          record_label: string | null
          record_label_plural: string | null
          stages: Json | null
          tagline: string | null
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          value_label: string | null
          verifications: Json | null
          won_stages: Json | null
        }
        Insert: {
          agents?: Json | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          fields?: Json | null
          gradient?: string | null
          group_slug: string
          id?: string
          is_custom?: boolean
          kpi_labels?: Json | null
          lost_stages?: Json | null
          name?: string | null
          pack_slug: string
          party_label?: string | null
          record_label?: string | null
          record_label_plural?: string | null
          stages?: Json | null
          tagline?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value_label?: string | null
          verifications?: Json | null
          won_stages?: Json | null
        }
        Update: {
          agents?: Json | null
          archived_at?: string | null
          created_at?: string
          description?: string | null
          fields?: Json | null
          gradient?: string | null
          group_slug?: string
          id?: string
          is_custom?: boolean
          kpi_labels?: Json | null
          lost_stages?: Json | null
          name?: string | null
          pack_slug?: string
          party_label?: string | null
          record_label?: string | null
          record_label_plural?: string | null
          stages?: Json | null
          tagline?: string | null
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value_label?: string | null
          verifications?: Json | null
          won_stages?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_documents: {
        Row: {
          created_at: string
          doc_type: string
          id: string
          name: string
          notes: string | null
          record_id: string
          status: string
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string
          id?: string
          name: string
          notes?: string | null
          record_id: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string
          id?: string
          name?: string
          notes?: string | null
          record_id?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_documents_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_payments: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          decision_note: string | null
          due_date: string | null
          id: string
          kind: string
          label: string
          method: string | null
          paid_at: string | null
          payer_note: string | null
          record_id: string
          reference: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          decision_note?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          label: string
          method?: string | null
          paid_at?: string | null
          payer_note?: string | null
          record_id: string
          reference?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          decision_note?: string | null
          due_date?: string | null
          id?: string
          kind?: string
          label?: string
          method?: string | null
          paid_at?: string | null
          payer_note?: string | null
          record_id?: string
          reference?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_payments_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_records: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          channel_id: string | null
          city: string | null
          closed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          fields: Json
          group_slug: string
          id: string
          lead_id: string | null
          next_action_at: string | null
          notes: string | null
          owner_id: string | null
          pack_slug: string
          priority: string
          source: string | null
          stage: string
          tenant_id: string | null
          title: string
          updated_at: string
          value: number | null
          won: boolean | null
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          city?: string | null
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          fields?: Json
          group_slug: string
          id?: string
          lead_id?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          pack_slug: string
          priority?: string
          source?: string | null
          stage: string
          tenant_id?: string | null
          title: string
          updated_at?: string
          value?: number | null
          won?: boolean | null
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          channel_id?: string | null
          city?: string | null
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          fields?: Json
          group_slug?: string
          id?: string
          lead_id?: string | null
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          pack_slug?: string
          priority?: string
          source?: string | null
          stage?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          value?: number | null
          won?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pack_records_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "lead_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_records_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "lead_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          description: string | null
          enabled: boolean
          feature_key: string
          id: string
          numeric_limit: number | null
          plan: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          feature_key: string
          id?: string
          numeric_limit?: number | null
          plan: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          feature_key?: string
          id?: string
          numeric_limit?: number | null
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          designation: string | null
          email: string
          full_name: string | null
          id: string
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          designation?: string | null
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          designation?: string | null
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposal_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: string
          id: string
          lead_id: string | null
          metadata: Json
          proposal_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          proposal_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          metadata?: Json
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          default_value: number | null
          description: string | null
          group_slug: string | null
          id: string
          industry: string | null
          is_shared: boolean
          name: string
          pack_slug: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          default_value?: number | null
          description?: string | null
          group_slug?: string | null
          id?: string
          industry?: string | null
          is_shared?: boolean
          name: string
          pack_slug?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          default_value?: number | null
          description?: string | null
          group_slug?: string | null
          id?: string
          industry?: string | null
          is_shared?: boolean
          name?: string
          pack_slug?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_versions: {
        Row: {
          ai_content: string | null
          changed_by: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          proposal_id: string
          stage: string | null
          title: string
          value: number | null
          version: number
        }
        Insert: {
          ai_content?: string | null
          changed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          proposal_id: string
          stage?: string | null
          title: string
          value?: number | null
          version: number
        }
        Update: {
          ai_content?: string | null
          changed_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          proposal_id?: string
          stage?: string | null
          title?: string
          value?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          ai_content: string | null
          approval_notes: string | null
          approval_requested_at: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          close_date: string | null
          company_id: string | null
          contact_id: string | null
          converted_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          group_slug: string | null
          id: string
          industry_group: string | null
          lead_id: string | null
          notes: string | null
          owner_id: string | null
          pack_record_id: string | null
          pack_slug: string | null
          probability: number
          reviewed_at: string | null
          sent_at: string | null
          stage: string
          tenant_id: string | null
          title: string
          updated_at: string
          value: number
          version: number
        }
        Insert: {
          ai_content?: string | null
          approval_notes?: string | null
          approval_requested_at?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          group_slug?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pack_record_id?: string | null
          pack_slug?: string | null
          probability?: number
          reviewed_at?: string | null
          sent_at?: string | null
          stage?: string
          tenant_id?: string | null
          title: string
          updated_at?: string
          value?: number
          version?: number
        }
        Update: {
          ai_content?: string | null
          approval_notes?: string | null
          approval_requested_at?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          close_date?: string | null
          company_id?: string | null
          contact_id?: string | null
          converted_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          group_slug?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          notes?: string | null
          owner_id?: string | null
          pack_record_id?: string | null
          pack_slug?: string | null
          probability?: number
          reviewed_at?: string | null
          sent_at?: string | null
          stage?: string
          tenant_id?: string | null
          title?: string
          updated_at?: string
          value?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_pack_record_id_fkey"
            columns: ["pack_record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ps_commissions: {
        Row: {
          base_amount: number
          commission_amount: number
          commission_pct: number
          created_at: string
          id: string
          order_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          base_amount?: number
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          order_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          base_amount?: number
          commission_amount?: number
          commission_pct?: number
          created_at?: string
          id?: string
          order_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ps_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ps_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ps_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "ps_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "ps_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ps_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ps_products"
            referencedColumns: ["id"]
          },
        ]
      }
      ps_orders: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          discount: number
          id: string
          kind: string
          notes: string | null
          order_no: string
          owner_id: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          discount?: number
          id?: string
          kind?: string
          notes?: string | null
          order_no?: string
          owner_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          id?: string
          kind?: string
          notes?: string | null
          order_no?: string
          owner_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      ps_products: {
        Row: {
          active: boolean
          category: string | null
          commission_pct: number
          cost: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string | null
          price: number
          sku: string
          stock: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          commission_pct?: number
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          price?: number
          sku: string
          stock?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          commission_pct?: number
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          price?: number
          sku?: string
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      re_clients: {
        Row: {
          agent_id: string | null
          budget_max: number | null
          budget_min: number | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          kyc_documents: Json | null
          kyc_status: string | null
          owner_id: string | null
          phone: string | null
          preferred_city: string | null
          preferred_type: string | null
          requirement: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          kyc_documents?: Json | null
          kyc_status?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_city?: string | null
          preferred_type?: string | null
          requirement?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          kyc_documents?: Json | null
          kyc_status?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_city?: string | null
          preferred_type?: string | null
          requirement?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      re_deals: {
        Row: {
          agent_id: string | null
          client_id: string | null
          closed_at: string | null
          created_at: string | null
          expected_value: number | null
          final_value: number | null
          id: string
          next_action_at: string | null
          notes: string | null
          owner_id: string | null
          property_id: string | null
          stage: string
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          expected_value?: number | null
          final_value?: number | null
          id?: string
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          property_id?: string | null
          stage?: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          created_at?: string | null
          expected_value?: number | null
          final_value?: number | null
          id?: string
          next_action_at?: string | null
          notes?: string | null
          owner_id?: string | null
          property_id?: string | null
          stage?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "re_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "re_properties"
            referencedColumns: ["id"]
          },
        ]
      }
      re_properties: {
        Row: {
          address: string | null
          area_sqft: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          created_at: string | null
          description: string | null
          id: string
          images: Json | null
          owner_id: string | null
          price: number | null
          property_type: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          area_sqft?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          owner_id?: string | null
          price?: number | null
          property_type?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          area_sqft?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: Json | null
          owner_id?: string | null
          price?: number | null
          property_type?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sheet_sync_configs: {
        Row: {
          column_mapping: Json
          created_at: string
          created_by: string | null
          group_slug: string | null
          id: string
          is_enabled: boolean
          last_row_count: number | null
          last_run_at: string | null
          last_status: string | null
          name: string
          pack_slug: string | null
          range_a1: string
          spreadsheet_id: string
          sync_interval: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          column_mapping?: Json
          created_at?: string
          created_by?: string | null
          group_slug?: string | null
          id?: string
          is_enabled?: boolean
          last_row_count?: number | null
          last_run_at?: string | null
          last_status?: string | null
          name: string
          pack_slug?: string | null
          range_a1: string
          spreadsheet_id: string
          sync_interval?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          created_by?: string | null
          group_slug?: string | null
          id?: string
          is_enabled?: boolean
          last_row_count?: number | null
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          pack_slug?: string | null
          range_a1?: string
          spreadsheet_id?: string
          sync_interval?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheet_sync_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_sync_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_policies: {
        Row: {
          first_response_mins: number
          id: string
          priority: string
          resolve_mins: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          first_response_mins: number
          id?: string
          priority: string
          resolve_mins: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          first_response_mins?: number
          id?: string
          priority?: string
          resolve_mins?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sla_policies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_id: string | null
          channel: string
          created_at: string
          created_by: string | null
          description: string | null
          first_response_at: string | null
          id: string
          industry_group: string | null
          linked_lead_id: string | null
          priority: string
          requester_email: string
          requester_name: string | null
          resolved_at: string | null
          sla_breached: boolean
          sla_due_at: string | null
          status: string
          subject: string
          tags: string[] | null
          tenant_id: string | null
          ticket_number: number
          updated_at: string
          urgency: string
        }
        Insert: {
          assignee_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          first_response_at?: string | null
          id?: string
          industry_group?: string | null
          linked_lead_id?: string | null
          priority?: string
          requester_email: string
          requester_name?: string | null
          resolved_at?: string | null
          sla_breached?: boolean
          sla_due_at?: string | null
          status?: string
          subject: string
          tags?: string[] | null
          tenant_id?: string | null
          ticket_number?: number
          updated_at?: string
          urgency?: string
        }
        Update: {
          assignee_id?: string | null
          channel?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          first_response_at?: string | null
          id?: string
          industry_group?: string | null
          linked_lead_id?: string | null
          priority?: string
          requester_email?: string
          requester_name?: string | null
          resolved_at?: string | null
          sla_breached?: boolean
          sla_due_at?: string | null
          status?: string
          subject?: string
          tags?: string[] | null
          tenant_id?: string | null
          ticket_number?: number
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          attachments: Json
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          industry_group: string | null
          lead_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          reminder_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachments?: Json
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachments?: Json
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          industry_group?: string | null
          lead_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_landing_pages: {
        Row: {
          created_at: string
          cta_label: string | null
          features: Json
          hero_headline: string
          hero_subheadline: string | null
          id: string
          industry: string
          is_published: boolean
          og_image: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          tenant_id: string
          testimonial: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          features?: Json
          hero_headline: string
          hero_subheadline?: string | null
          id?: string
          industry: string
          is_published?: boolean
          og_image?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          tenant_id: string
          testimonial?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          features?: Json
          hero_headline?: string
          hero_subheadline?: string | null
          id?: string
          industry?: string
          is_published?: boolean
          og_image?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          tenant_id?: string
          testimonial?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_landing_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_landing_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          member_role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_webhook_secrets: {
        Row: {
          created_at: string
          tenant_id: string
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          created_at?: string
          tenant_id: string
          updated_at?: string
          webhook_secret: string
        }
        Update: {
          created_at?: string
          tenant_id?: string
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_webhook_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_webhook_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accent_color: string | null
          created_at: string
          custom_domain: string | null
          favicon_url: string | null
          id: string
          industry: string | null
          is_active: boolean
          is_isolated: boolean
          logo_url: string | null
          name: string
          owner_id: string | null
          plan: string
          primary_color: string | null
          slug: string
          tagline: string | null
          updated_at: string
          webhook_backoff_base_minutes: number
          webhook_backoff_factor: number
          webhook_hmac_enabled: boolean
          webhook_max_attempts: number
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          custom_domain?: string | null
          favicon_url?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          is_isolated?: boolean
          logo_url?: string | null
          name: string
          owner_id?: string | null
          plan?: string
          primary_color?: string | null
          slug: string
          tagline?: string | null
          updated_at?: string
          webhook_backoff_base_minutes?: number
          webhook_backoff_factor?: number
          webhook_hmac_enabled?: boolean
          webhook_max_attempts?: number
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          custom_domain?: string | null
          favicon_url?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean
          is_isolated?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          plan?: string
          primary_color?: string | null
          slug?: string
          tagline?: string | null
          updated_at?: string
          webhook_backoff_base_minutes?: number
          webhook_backoff_factor?: number
          webhook_hmac_enabled?: boolean
          webhook_max_attempts?: number
        }
        Relationships: []
      }
      ticket_macros: {
        Row: {
          actions: Json
          body: string | null
          created_at: string
          id: string
          name: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          actions?: Json
          body?: string | null
          created_at?: string
          id?: string
          name: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          actions?: Json
          body?: string | null
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_macros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_macros_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          attachments: Json | null
          author_email: string | null
          author_id: string | null
          author_name: string | null
          body: string
          created_at: string
          id: string
          is_public: boolean
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          is_public?: boolean
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          author_email?: string | null
          author_id?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          is_public?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_industry_access: {
        Row: {
          created_at: string
          id: string
          industry_group: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          industry_group: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          industry_group?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verifications: {
        Row: {
          created_at: string
          error: string | null
          id: string
          identifier_masked: string | null
          kind: string
          lead_id: string | null
          provider: string
          record_id: string | null
          requested_by: string | null
          result: Json
          score: number | null
          status: string
          subject_name: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          identifier_masked?: string | null
          kind: string
          lead_id?: string | null
          provider?: string
          record_id?: string | null
          requested_by?: string | null
          result?: Json
          score?: number | null
          status?: string
          subject_name?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          identifier_masked?: string | null
          kind?: string
          lead_id?: string | null
          provider?: string
          record_id?: string | null
          requested_by?: string | null
          result?: Json
          score?: number | null
          status?: string
          subject_name?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "pack_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      tenants_public: {
        Row: {
          accent_color: string | null
          favicon_url: string | null
          id: string | null
          industry: string | null
          logo_url: string | null
          name: string | null
          plan: string | null
          primary_color: string | null
          slug: string | null
          tagline: string | null
        }
        Insert: {
          accent_color?: string | null
          favicon_url?: string | null
          id?: string | null
          industry?: string | null
          logo_url?: string | null
          name?: string | null
          plan?: string | null
          primary_color?: string | null
          slug?: string | null
          tagline?: string | null
        }
        Update: {
          accent_color?: string | null
          favicon_url?: string | null
          id?: string | null
          industry?: string | null
          logo_url?: string | null
          name?: string | null
          plan?: string | null
          primary_color?: string | null
          slug?: string | null
          tagline?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_tenant_member: {
        Args: { _tenant: string; _user: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "sales_manager" | "sales_executive"
      commission_status: "pending" | "invoiced" | "received" | "cancelled"
      doc_status: "pending" | "uploaded" | "verified" | "rejected"
      doc_type:
        | "pan"
        | "aadhaar"
        | "bank_stmt"
        | "itr"
        | "salary_slip"
        | "form16"
        | "photo"
        | "address_proof"
        | "property_papers"
        | "other"
      employment_type:
        | "salaried"
        | "self_employed"
        | "business"
        | "professional"
        | "retired"
        | "other"
      lead_priority: "low" | "medium" | "high" | "urgent"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal_sent"
        | "negotiation"
        | "won"
        | "lost"
      loan_stage:
        | "new"
        | "docs_pending"
        | "docs_collected"
        | "login"
        | "under_review"
        | "sanctioned"
        | "disbursed"
        | "rejected"
        | "on_hold"
      loan_type:
        | "personal"
        | "home"
        | "business"
        | "lap"
        | "auto"
        | "education"
        | "gold"
      meeting_status: "scheduled" | "completed" | "cancelled" | "no_show"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "done" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["super_admin", "admin", "sales_manager", "sales_executive"],
      commission_status: ["pending", "invoiced", "received", "cancelled"],
      doc_status: ["pending", "uploaded", "verified", "rejected"],
      doc_type: [
        "pan",
        "aadhaar",
        "bank_stmt",
        "itr",
        "salary_slip",
        "form16",
        "photo",
        "address_proof",
        "property_papers",
        "other",
      ],
      employment_type: [
        "salaried",
        "self_employed",
        "business",
        "professional",
        "retired",
        "other",
      ],
      lead_priority: ["low", "medium", "high", "urgent"],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal_sent",
        "negotiation",
        "won",
        "lost",
      ],
      loan_stage: [
        "new",
        "docs_pending",
        "docs_collected",
        "login",
        "under_review",
        "sanctioned",
        "disbursed",
        "rejected",
        "on_hold",
      ],
      loan_type: [
        "personal",
        "home",
        "business",
        "lap",
        "auto",
        "education",
        "gold",
      ],
      meeting_status: ["scheduled", "completed", "cancelled", "no_show"],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "done", "cancelled"],
    },
  },
} as const
