import React, { useState, useEffect } from 'react';
import { Music, Play, Folder, Search, RefreshCw, Plus, Users, Calendar, Settings, Trash2 } from 'lucide-react';
import { useMusic } from '../../contexts/MusicContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { GitHubService } from '../../services/githubService';
import AdminBulkImportModal from '../Modals/AdminBulkImportModal';

interface LibraryPageProps {
  onPlaylistSelect: (playlistId: string) => void;
}

interface StreamingSource {
  id: string;
  name: string;
  drive_link: string;
  created_by: string | null;
  last_synced: string;
  created_at: string;
  creator_name?: string;
}

const LibraryPage: React.FC<LibraryPageProps> = ({ onPlaylistSelect }) => {
  const { playlists, loadPlaylists } = useMusic();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [streamingSources, setStreamingSources] = useState<StreamingSource[]>([]);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [showAdminBulkImport, setShowAdminBulkImport] = useState(false);

  // Check if user is admin (you can modify this logic based on your admin system)
  const isAdmin = user?.email === 'meeoundnp@gmail.com' || user?.id === 'ADMIN';

  const filteredPlaylists = playlists.filter(playlist =>
    playlist.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    loadStreamingSources();
  }, []);

  const loadStreamingSources = async () => {
    try {
      const { data, error } = await supabase
        .from('streaming_sources')
        .select(`
          *,
          user_profiles!streaming_sources_created_by_fkey(display_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const sourcesWithCreator = data?.map(source => ({
        ...source,
        creator_name: source.user_profiles?.display_name || 'Unknown'
      })) || [];

      setStreamingSources(sourcesWithCreator);
    } catch (error) {
      console.error('Error loading streaming sources:', error);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await loadPlaylists();
      await loadStreamingSources();
    } finally {
      setLoading(false);
    }
  };

  // Helper function to find or create a song
  const findOrCreateSong = async (playlistId: string, songData: any) => {
    try {
      // First, check if a song with this unique_link already exists
      const { data: existingSong, error: findError } = await supabase
        .from('songs')
        .select('id, playlist_id')
        .eq('unique_link', songData.unique_link)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected for new songs
        throw findError;
      }

      if (existingSong) {
        // Song exists, check if it's already in this playlist
        if (existingSong.playlist_id === playlistId) {
          // Song is already in this playlist, skip
          return existingSong;
        } else {
          // Song exists but in a different playlist
          // For now, we'll skip adding it to avoid conflicts
          // You could modify this logic based on your requirements
          console.log(`Song ${songData.title} already exists in another playlist, skipping...`);
          return null;
        }
      } else {
        // Song doesn't exist, create it
        const { data: newSong, error: insertError } = await supabase
          .from('songs')
          .insert([{
            playlist_id: playlistId,
            title: songData.title,
            duration: songData.duration,
            file_path: songData.file_path,
            unique_link: songData.unique_link,
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        return newSong;
      }
    } catch (error) {
      console.error('Error in findOrCreateSong:', error);
      throw error;
    }
  };

  const handleRefreshSource = async (source: StreamingSource) => {
    if (!user) return;
    
    setRefreshing(source.id);
    try {
      // Parse GitHub URL
      const repoInfo = GitHubService.parseGitHubUrl(source.drive_link);
      if (!repoInfo) {
        throw new Error('Invalid GitHub repository URL');
      }

      // Scan repository for new content
      const { playlists: newPlaylists } = await GitHubService.scanRepositoryStructure(
        repoInfo.owner, 
        repoInfo.repo
      );

      // Get existing playlists for this source and user
      const { data: existingPlaylists } = await supabase
        .from('playlists')
        .select('name, folder_path')
        .eq('source_id', source.id)
        .eq('user_id', user.id);

      const existingPaths = new Set(existingPlaylists?.map(p => p.folder_path) || []);

      // Find new playlists
      const newPlaylistsToAdd = newPlaylists.filter(playlist => 
        !existingPaths.has(playlist.path)
      );

      if (newPlaylistsToAdd.length === 0) {
        alert('No new playlists found in this repository.');
        return;
      }

      let addedSongsCount = 0;

      // Add new playlists and songs
      for (const playlist of newPlaylistsToAdd) {
        // Create playlist for current user
        const { data: playlistData, error: playlistError } = await supabase
          .from('playlists')
          .insert([
            {
              user_id: user.id,
              source_id: source.id,
              name: playlist.name,
              folder_path: playlist.path,
            },
          ])
          .select()
          .single();

        if (playlistError) {
          console.error('Error creating playlist:', playlistError);
          continue;
        }

        // Create songs for this playlist using the helper function
        for (const song of playlist.songs) {
          const uniqueLink = GitHubService.generateUniqueLink(
            repoInfo.owner,
            repoInfo.repo,
            song.path
          );

          const songData = {
            title: song.name,
            duration: 180, // Default duration
            file_path: song.downloadUrl,
            unique_link: uniqueLink,
          };

          try {
            const result = await findOrCreateSong(playlistData.id, songData);
            if (result) {
              addedSongsCount++;
            }
          } catch (error) {
            console.error(`Error adding song ${song.name}:`, error);
            // Continue with other songs even if one fails
          }
        }
      }

      // Update last_synced timestamp
      await supabase
        .from('streaming_sources')
        .update({ last_synced: new Date().toISOString() })
        .eq('id', source.id);

      // Refresh data
      await loadPlaylists();
      await loadStreamingSources();

      alert(`Added ${newPlaylistsToAdd.length} new playlist(s) with ${addedSongsCount} songs from ${source.name}!`);
    } catch (error: any) {
      console.error('Error refreshing source:', error);
      alert(`Error refreshing source: ${error.message}`);
    } finally {
      setRefreshing(null);
    }
  };

  const handleDeletePlaylist = async (playlistId: string, playlistName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent playlist selection when clicking delete
    
    if (!confirm(`Are you sure you want to delete the playlist "${playlistName}"? This action cannot be undone.`)) {
      return;
    }

    setDeleting(playlistId);
    try {
      // Delete the playlist (songs will be deleted automatically due to CASCADE)
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistId)
        .eq('user_id', user?.id); // Ensure user can only delete their own playlists

      if (error) throw error;

      // Refresh playlists
      await loadPlaylists();
      
      alert(`Playlist "${playlistName}" has been deleted successfully.`);
    } catch (error: any) {
      console.error('Error deleting playlist:', error);
      alert(`Error deleting playlist: ${error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkImportSuccess = async () => {
    await loadPlaylists();
    await loadStreamingSources();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return formatDate(dateString);
  };

  return (
    <div className="p-6 pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Your Library
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Browse your music collection and playlists
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Streaming Sources Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Music Sources
            </h2>
            <div className="flex space-x-2">
              {isAdmin && (
                <button
                  onClick={() => setShowAdminBulkImport(true)}
                  className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"
                  title="Admin: Bulk import from URL"
                >
                  <Settings className="h-4 w-4" />
                  <span>Bulk Import</span>
                </button>
              )}
              <button
                onClick={() => setShowAddSourceModal(true)}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Source</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {streamingSources.map((source) => (
              <div
                key={source.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {source.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center mt-1">
                      <Users className="h-3 w-3 mr-1" />
                      by {source.creator_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center mt-1">
                      <Calendar className="h-3 w-3 mr-1" />
                      Synced {formatTimeAgo(source.last_synced)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRefreshSource(source)}
                    disabled={refreshing === source.id}
                    className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-1 rounded text-sm transition-colors"
                    title="Refresh this source for new content"
                  >
                    <RefreshCw className={`h-3 w-3 ${refreshing === source.id ? 'animate-spin' : ''}`} />
                    <span>Sync</span>
                  </button>
                </div>
                <a
                  href={source.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block"
                >
                  {source.drive_link}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Playlists Grid */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Your Playlists ({filteredPlaylists.length})
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPlaylists.map((playlist) => (
              <div
                key={playlist.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow group cursor-pointer relative"
                onClick={() => onPlaylistSelect(playlist.id)}
              >
                {/* Delete button */}
                <button
                  onClick={(e) => handleDeletePlaylist(playlist.id, playlist.name, e)}
                  disabled={deleting === playlist.id}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white p-2 rounded-full transition-all z-10"
                  title="Delete playlist"
                >
                  {deleting === playlist.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>

                <div className="flex items-center justify-between mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center">
                    <Folder className="h-8 w-8 text-white" />
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full transition-all">
                    <Play className="h-5 w-5" />
                  </button>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2 truncate">
                  {playlist.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {playlist.folder_path}
                </p>
              </div>
            ))}
          </div>

          {filteredPlaylists.length === 0 && !loading && (
            <div className="text-center py-12">
              <Music className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchQuery ? 'No playlists found' : 'No playlists yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery 
                  ? 'Try adjusting your search terms' 
                  : 'Add a GitHub repository to get started'
                }
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 text-purple-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500 dark:text-gray-400">Loading playlists...</p>
            </div>
          )}
        </div>
      </div>

      {/* Admin Bulk Import Modal */}
      <AdminBulkImportModal
        isOpen={showAdminBulkImport}
        onClose={() => setShowAdminBulkImport(false)}
        onSuccess={handleBulkImportSuccess}
      />
    </div>
  );
};

export default LibraryPage;