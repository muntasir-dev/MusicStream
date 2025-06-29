/*
  # Music Streaming Platform Database Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, references auth.users)
      - `display_name` (text)
      - `avatar_url` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `streaming_sources`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `name` (text)
      - `drive_link` (text)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `playlists`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `source_id` (uuid, references streaming_sources)
      - `name` (text)
      - `folder_path` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `songs`
      - `id` (uuid, primary key)
      - `playlist_id` (uuid, references playlists)
      - `title` (text)
      - `duration` (integer)
      - `file_path` (text)
      - `cover_art_url` (text)
      - `unique_link` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `user_favourites`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `song_id` (uuid, references songs)
      - `created_at` (timestamp)
    
    - `user_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `theme` (text, default 'light')
      - `volume` (integer, default 50)
      - `auto_play` (boolean, default false)
      - `shuffle_mode` (boolean, default false)
      - `loop_mode` (text, default 'off')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create streaming_sources table
CREATE TABLE IF NOT EXISTS streaming_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  drive_link text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  source_id uuid REFERENCES streaming_sources(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  folder_path text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create songs table
CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid REFERENCES playlists(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  duration integer DEFAULT 0,
  file_path text NOT NULL,
  cover_art_url text,
  unique_link text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_favourites table
CREATE TABLE IF NOT EXISTS user_favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  song_id uuid REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, song_id)
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  volume integer DEFAULT 50 CHECK (volume >= 0 AND volume <= 100),
  auto_play boolean DEFAULT false,
  shuffle_mode boolean DEFAULT false,
  loop_mode text DEFAULT 'off' CHECK (loop_mode IN ('off', 'one', 'all')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaming_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policies for streaming_sources
CREATE POLICY "Users can manage own streaming sources"
  ON streaming_sources
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for playlists
CREATE POLICY "Users can view all playlists"
  ON playlists
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage own playlists"
  ON playlists
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for songs
CREATE POLICY "Users can view all songs"
  ON songs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage songs in their playlists"
  ON songs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM playlists 
      WHERE playlists.id = songs.playlist_id 
      AND playlists.user_id = auth.uid()
    )
  );

-- Create policies for user_favourites
CREATE POLICY "Users can manage own favourites"
  ON user_favourites
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for user_settings
CREATE POLICY "Users can manage own settings"
  ON user_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_streaming_sources_user_id ON streaming_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_user_id ON playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_playlists_source_id ON playlists(source_id);
CREATE INDEX IF NOT EXISTS idx_songs_playlist_id ON songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_songs_unique_link ON songs(unique_link);
CREATE INDEX IF NOT EXISTS idx_user_favourites_user_id ON user_favourites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favourites_song_id ON user_favourites(song_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);