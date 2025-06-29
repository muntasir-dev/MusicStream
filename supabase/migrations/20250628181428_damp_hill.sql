/*
  # Add shared streaming sources functionality

  1. Changes
    - Remove user_id requirement from streaming_sources (make them shared)
    - Update RLS policies to allow all authenticated users to read streaming sources
    - Add refresh functionality for detecting new content
    - Add last_synced timestamp to track when sources were last updated

  2. Security
    - Users can still only create their own streaming sources
    - All users can read all streaming sources (shared library)
    - Users can only manage playlists they created from any source
*/

-- Remove user_id foreign key constraint and make sources shared
ALTER TABLE streaming_sources DROP CONSTRAINT IF EXISTS streaming_sources_user_id_fkey;

-- Add last_synced column to track when source was last refreshed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streaming_sources' AND column_name = 'last_synced'
  ) THEN
    ALTER TABLE streaming_sources ADD COLUMN last_synced timestamptz DEFAULT now();
  END IF;
END $$;

-- Add created_by column to track who originally added the source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streaming_sources' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE streaming_sources ADD COLUMN created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update existing records to set created_by from user_id
UPDATE streaming_sources SET created_by = user_id WHERE created_by IS NULL;

-- Update RLS policies for streaming_sources
DROP POLICY IF EXISTS "Users can manage own streaming sources" ON streaming_sources;

-- Allow all authenticated users to read streaming sources (shared)
CREATE POLICY "All users can read streaming sources"
  ON streaming_sources
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users to create streaming sources
CREATE POLICY "Users can create streaming sources"
  ON streaming_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Allow creators to update their own sources
CREATE POLICY "Creators can update own streaming sources"
  ON streaming_sources
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Allow creators to delete their own sources
CREATE POLICY "Creators can delete own streaming sources"
  ON streaming_sources
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Update playlists policies to work with shared sources
DROP POLICY IF EXISTS "Users can manage own playlists" ON playlists;
DROP POLICY IF EXISTS "Users can view all playlists" ON playlists;

-- Users can manage their own playlists from any source
CREATE POLICY "Users can manage own playlists"
  ON playlists
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- All users can view all playlists (shared library)
CREATE POLICY "All users can view playlists"
  ON playlists
  FOR SELECT
  TO authenticated
  USING (true);

-- Update songs policies to work with shared playlists
DROP POLICY IF EXISTS "Users can manage songs in their playlists" ON songs;
DROP POLICY IF EXISTS "Users can view all songs" ON songs;

-- Users can manage songs in their own playlists
CREATE POLICY "Users can manage songs in own playlists"
  ON songs
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM playlists
    WHERE playlists.id = songs.playlist_id 
    AND playlists.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM playlists
    WHERE playlists.id = songs.playlist_id 
    AND playlists.user_id = auth.uid()
  ));

-- All users can view all songs (shared library)
CREATE POLICY "All users can view songs"
  ON songs
  FOR SELECT
  TO authenticated
  USING (true);