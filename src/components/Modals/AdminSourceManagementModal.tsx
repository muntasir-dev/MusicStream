import React, { useState, useEffect } from 'react';
import { X, Trash2, AlertCircle, Loader, CheckCircle, Calendar, User, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';
import { supabase } from '../../lib/supabase';

interface AdminSourceManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface StreamingSource {
  id: string;
  name: string;
  drive_link: string;
  created_at: string;
  created_by: string;
  is_active: boolean;
  creator_name?: string;
  playlist_count?: number;
}

const AdminSourceManagementModal: React.FC<AdminSourceManagementModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [sources, setSources] = useState<StreamingSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const { loadPlaylists } = useMusic();

  const loadSources = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch all streaming sources with creator information
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('streaming_sources')
        .select(`
          id,
          name,
          drive_link,
          created_at,
          created_by,
          is_active,
          user_profiles!streaming_sources_created_by_fkey (
            display_name
          )
        `)
        .order('created_at', { ascending: false });

      if (sourcesError) throw sourcesError;

      // Get playlist counts for each source
      const sourcesWithCounts = await Promise.all(
        (sourcesData || []).map(async (source) => {
          const { count } = await supabase
            .from('playlists')
            .select('*', { count: 'exact', head: true })
            .eq('source_id', source.id);

          return {
            ...source,
            creator_name: source.user_profiles?.display_name || 'Unknown',
            playlist_count: count || 0,
          };
        })
      );

      setSources(sourcesWithCounts);
    } catch (err: any) {
      setError(err.message || 'Failed to load streaming sources');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSource = async (sourceId: string, sourceName: string) => {
    if (!confirm(`Are you sure you want to delete "${sourceName}"? This will remove all associated playlists and songs for all users.`)) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(sourceId));

    try {
      // Delete the streaming source (cascading deletes will handle playlists and songs)
      const { error: deleteError } = await supabase
        .from('streaming_sources')
        .delete()
        .eq('id', sourceId);

      if (deleteError) throw deleteError;

      // Remove from local state
      setSources(prev => prev.filter(source => source.id !== sourceId));
      
      // Refresh the music context
      await loadPlaylists();
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to delete streaming source');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(sourceId);
        return newSet;
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRepoName = (githubUrl: string) => {
    const match = githubUrl.match(/github\.com\/([^\/]+\/[^\/]+)/);
    return match ? match[1] : githubUrl;
  };

  useEffect(() => {
    if (isOpen) {
      loadSources();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin: Manage Sources
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              <p className="font-medium mb-1">Admin Feature:</p>
              <p>Manage all streaming sources in the system. Deleting a source will remove all associated playlists and songs for all users.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-8 w-8 animate-spin text-purple-600" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading sources...</span>
          </div>
        ) : sources.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No streaming sources found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Total sources: {sources.length}
            </div>

            <div className="space-y-3">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {source.name}
                        </h3>
                        {!source.is_active && (
                          <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded">
                            Inactive
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center space-x-2">
                          <ExternalLink className="h-4 w-4" />
                          <a
                            href={source.drive_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                          >
                            {getRepoName(source.drive_link)}
                          </a>
                        </div>

                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4" />
                          <span>Created by: {source.creator_name}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4" />
                          <span>Added: {formatDate(source.created_at)}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>{source.playlist_count} playlists</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteSource(source.id, source.name)}
                      disabled={deletingIds.has(source.id)}
                      className="ml-4 flex items-center space-x-1 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors"
                    >
                      {deletingIds.has(source.id) ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin" />
                          <span>Deleting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSourceManagementModal;