export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      exercises: {
        Row: {
          id: string;
          user_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          data: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: Json;
          updated_at?: string;
        };
      };
      routines: {
        Row: {
          id: string;
          user_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          data: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: Json;
          updated_at?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          data: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: Json;
          updated_at?: string;
        };
      };
      maneuvers: {
        Row: {
          id: string;
          user_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          data: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: Json;
          updated_at?: string;
        };
      };
      sources: {
        Row: {
          id: string;
          user_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          data: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: Json;
          updated_at?: string;
        };
      };
      clips: {
        Row: {
          id: string;
          user_id: string;
          data: Json;
          storage_path: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          data: Json;
          storage_path?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: Json;
          storage_path?: string | null;
          updated_at?: string;
        };
      };
      annotations: {
        Row: {
          id: string;
          user_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          data: Json;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          data?: Json;
          updated_at?: string;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          data: Json;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          data: Json;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          data?: Json;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
