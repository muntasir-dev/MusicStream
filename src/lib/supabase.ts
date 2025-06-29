import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      streaming_sources: {
        Row: {
          id: string;
          created_by: string;
          name: string;
          drive_link: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_synced: string;
        };
        Insert: {
          id?: string;
          created_by: string;
          name: string;
          drive_link: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          last_synced?: string;
        };
        Update: {
          id?: string;
          created_by?: string;
          name?: string;
          drive_link?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          last_synced?: string;
        };
      };
      playlists: {
        Row: {
          id: string;
          user_id: string;
          source_id: string;
          name: string;
          folder_path: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_id: string;
          name: string;
          folder_path: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_id?: string;
          name?: string;
          folder_path?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      songs: {
        Row: {
          id: string;
          playlist_id: string;
          title: string;
          duration: number;
          file_path: string;
          cover_art_url: string | null;
          unique_link: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          playlist_id: string;
          title: string;
          duration?: number;
          file_path: string;
          cover_art_url?: string | null;
          unique_link: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          playlist_id?: string;
          title?: string;
          duration?: number;
          file_path?: string;
          cover_art_url?: string | null;
          unique_link?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_favourites: {
        Row: {
          id: string;
          user_id: string;
          song_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          song_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          song_id?: string;
          created_at?: string;
        };
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          theme: string;
          volume: number;
          auto_play: boolean;
          shuffle_mode: boolean;
          loop_mode: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          theme?: string;
          volume?: number;
          auto_play?: boolean;
          shuffle_mode?: boolean;
          loop_mode?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          theme?: string;
          volume?: number;
          auto_play?: boolean;
          shuffle_mode?: boolean;
          loop_mode?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};