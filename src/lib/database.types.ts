// Mirrors supabase/migrations. Same shape as `supabase gen types typescript`,
// so it can be regenerated with the CLI once the project is linked.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type HabitType = 'boolean' | 'quantitative' | 'negative'
export type FrequencyType = 'daily' | 'weekdays' | 'times_per_week' | 'every_n_days'
export type VizType = 'heatmap' | 'calendar' | 'ring' | 'bars' | 'days_since' | 'marble_jar' | 'plant'
export type TrackerSort = 'manual' | 'streak' | 'completion' | 'pending_first'
export type AgendaSubtab = 'todos' | 'habits'
export type Language = 'es' | 'en'
/** Traffic light: high = red, medium = orange, low = green. */
export type TodoPriority = 'high' | 'medium' | 'low'

export type Database = {
  public: {
    Tables: {
      user_settings: {
        Row: {
          user_id: string
          language: Language | null
          timezone: string
          tracker_columns: number
          tracker_sort: TrackerSort
          agenda_subtab: AgendaSubtab
          notifications_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          language?: Language | null
          timezone?: string
          tracker_columns?: number
          tracker_sort?: TrackerSort
          agenda_subtab?: AgendaSubtab
          notifications_enabled?: boolean
        }
        Update: {
          language?: Language | null
          timezone?: string
          tracker_columns?: number
          tracker_sort?: TrackerSort
          agenda_subtab?: AgendaSubtab
          notifications_enabled?: boolean
        }
        Relationships: []
      }
      habits: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string
          color: string
          type: HabitType
          target: number | null
          unit: string | null
          quick_step: number
          frequency_type: FrequencyType
          frequency_days: number[] | null
          frequency_times: number | null
          frequency_interval: number | null
          start_date: string
          reminder_times: string[]
          viz_type: VizType
          viz_config: Json
          sort_order: number
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          icon: string
          color: string
          type: HabitType
          target?: number | null
          unit?: string | null
          quick_step?: number
          frequency_type?: FrequencyType
          frequency_days?: number[] | null
          frequency_times?: number | null
          frequency_interval?: number | null
          start_date?: string
          reminder_times?: string[]
          viz_type: VizType
          viz_config?: Json
          sort_order?: number
          archived_at?: string | null
        }
        Update: {
          name?: string
          icon?: string
          color?: string
          type?: HabitType
          target?: number | null
          unit?: string | null
          quick_step?: number
          frequency_type?: FrequencyType
          frequency_days?: number[] | null
          frequency_times?: number | null
          frequency_interval?: number | null
          start_date?: string
          reminder_times?: string[]
          viz_type?: VizType
          viz_config?: Json
          sort_order?: number
          archived_at?: string | null
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          habit_id: string
          user_id: string
          log_date: string
          value: number
          created_at: string
          updated_at: string
        }
        Insert: {
          habit_id: string
          user_id?: string
          log_date: string
          value: number
        }
        Update: {
          value?: number
        }
        Relationships: []
      }
      todos: {
        Row: {
          id: string
          user_id: string
          title: string
          due_date: string
          completed_at: string | null
          reminder_time: string | null
          priority: TodoPriority
          started_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          title: string
          due_date: string
          completed_at?: string | null
          reminder_time?: string | null
          priority?: TodoPriority
          started_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          due_date?: string
          completed_at?: string | null
          reminder_time?: string | null
          priority?: TodoPriority
          started_at?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
          last_success_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
        }
        Update: {
          p256dh?: string
          auth?: string
          user_agent?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      reorder_habits: {
        Args: { habit_ids: string[] }
        Returns: undefined
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type UserSettings = Database['public']['Tables']['user_settings']['Row']
export type Habit = Database['public']['Tables']['habits']['Row']
export type HabitInsert = Database['public']['Tables']['habits']['Insert']
export type HabitUpdate = Database['public']['Tables']['habits']['Update']
export type HabitLog = Database['public']['Tables']['habit_logs']['Row']
export type Todo = Database['public']['Tables']['todos']['Row']
