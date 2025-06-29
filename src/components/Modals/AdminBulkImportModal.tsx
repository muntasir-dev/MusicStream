import React, { useState } from 'react';
import { X, Link, AlertCircle, Download, Loader, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';
import { supabase } from '../../lib/supabase';
import { GitHubService } from '../../services/githubService';

interface AdminBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  url: string;
  name: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
  playlistCount?: number;
}

const AdminBulkImportModal: React.FC<AdminBulkImportModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [sourceUrl, setSourceUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [currentStep, setCurrentStep] = useState<'input' | 'processing' | 'results'>('input');
  const { user } = useAuth();
  const { loadPlaylists } = useMusic();

  const extractGitHubUrls = (text: string): string[] => {
    const githubUrlPattern = /https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+/g;
    const urls = text.match(githubUrlPattern) || [];
    return [...new Set(urls)]; // Remove duplicates
  };

  const generateSourceName = (githubUrl: string): string => {
    const repoInfo = GitHubService.parseGitHubUrl(githubUrl);
    if (!repoInfo) return 'Unknown Repository';
    return `${repoInfo.owner}/${repoInfo.repo}`;
  };

  const findOrCreateSong = async (songData: any, playlistId: string, repoInfo: any) => {
    const uniqueLink = GitHubService.generateUniqueLink(
      repoInfo.owner,
      repoInfo.repo,
      songData.path
    );

    // First, check if a song with this unique_link already exists
    const { data: existingSong } = await supabase
      .from('songs')
      .select('id')
      .eq('unique_link', uniqueLink)
      .single();

    if (existingSong) {
      // Song already exists, update its playlist_id to the new playlist
      const { error: updateError } = await supabase
        .from('songs')
        .update({ playlist_id: playlistId })
        .eq('id', existingSong.id);

      if (updateError) {
        console.error('Error updating existing song:', updateError);
      }
      return existingSong.id;
    } else {
      // Song doesn't exist, create a new one
      const { data: newSong, error: insertError } = await supabase
        .from('songs')
        .insert([{
          playlist_id: playlistId,
          title: songData.name,
          duration: 180, // Default duration
          file_path: songData.downloadUrl,
          unique_link: uniqueLink,
        }])
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating new song:', insertError);
        return null;
      }
      return newSong.id;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    setProgress('Fetching source list...');

    try {
      // Fetch the content from the provided URL
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch source list: ${response.status} ${response.statusText}`);
      }

      const textContent = await response.text();
      const githubUrls = extractGitHubUrls(textContent);

      if (githubUrls.length === 0) {
        throw new Error('No GitHub repository URLs found in the provided source');
      }

      setProgress(`Found ${githubUrls.length} GitHub repositories. Preparing import...`);

      // Initialize import results
      const results: ImportResult[] = githubUrls.map(url => ({
        url,
        name: generateSourceName(url),
        status: 'pending'
      }));

      setImportResults(results);
      setCurrentStep('processing');

      // Process each repository
      for (let i = 0; i < githubUrls.length; i++) {
        const url = githubUrls[i];
        const repoName = generateSourceName(url);
        
        setProgress(`Processing ${i + 1}/${githubUrls.length}: ${repoName}`);
        
        // Update status to processing
        setImportResults(prev => prev.map(result => 
          result.url === url ? { ...result, status: 'processing' } : result
        ));

        try {
          // Check if repository already exists
          const { data: existingSources } = await supabase
            .from('streaming_sources')
            .select('id, name')
            .eq('drive_link', url.trim());

          let sourceData;
          if (existingSources && existingSources.length > 0) {
            sourceData = existingSources[0];
          } else {
            // Parse GitHub URL
            const repoInfo = GitHubService.parseGitHubUrl(url);
            if (!repoInfo) {
              setImportResults(prev => prev.map(result => 
                result.url === url ? { 
                  ...result, 
                  status: 'error', 
                  error: 'Invalid GitHub URL format' 
                } : result
              ));
              continue;
            }

            // Create streaming source
            const { data: newSourceData, error: sourceError } = await supabase
              .from('streaming_sources')
              .insert([
                {
                  name: repoName,
                  drive_link: url.trim(),
                  created_by: user.id,
                  last_synced: new Date().toISOString(),
                },
              ])
              .select()
              .single();

            if (sourceError) throw sourceError;
            sourceData = newSourceData;
          }

          // Parse GitHub URL for scanning
          const repoInfo = GitHubService.parseGitHubUrl(url);
          if (!repoInfo) {
            setImportResults(prev => prev.map(result => 
              result.url === url ? { 
                ...result, 
                status: 'error', 
                error: 'Invalid GitHub URL format' 
              } : result
            ));
            continue;
          }

          // Scan repository for playlists and songs
          const { playlists } = await GitHubService.scanRepositoryStructure(
            repoInfo.owner, 
            repoInfo.repo
          );

          if (playlists.length === 0) {
            setImportResults(prev => prev.map(result => 
              result.url === url ? { 
                ...result, 
                status: 'error', 
                error: 'No audio files found in repository' 
              } : result
            ));
            continue;
          }

          // Create playlists and songs for the admin user
          let totalPlaylistsCreated = 0;
          for (const playlist of playlists) {
            // Create playlist
            const { data: playlistData, error: playlistError } = await supabase
              .from('playlists')
              .insert([
                {
                  user_id: user.id,
                  source_id: sourceData.id,
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

            // Create or link songs for this playlist
            let songsCreated = 0;
            for (const song of playlist.songs) {
              const songId = await findOrCreateSong(song, playlistData.id, repoInfo);
              if (songId) {
                songsCreated++;
              }
            }

            if (songsCreated > 0) {
              totalPlaylistsCreated++;
            }
          }

          setImportResults(prev => prev.map(result => 
            result.url === url ? { 
              ...result, 
              status: 'success', 
              playlistCount: totalPlaylistsCreated 
            } : result
          ));

        } catch (err: any) {
          console.error(`Error processing ${url}:`, err);
          setImportResults(prev => prev.map(result => 
            result.url === url ? { 
              ...result, 
              status: 'error', 
              error: err.message || 'Unknown error' 
            } : result
          ));
        }

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setProgress('Import completed!');
      setCurrentStep('results');
      
      // Refresh the music context
      await loadPlaylists();

    } catch (err: any) {
      setError(err.message || 'Failed to import sources');
      setCurrentStep('input');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setCurrentStep('input');
      setImportResults([]);
      setSourceUrl('');
      setError('');
    }
  };

  const handleFinish = () => {
    onSuccess();
    handleClose();
  };

  const getSuccessCount = () => importResults.filter(r => r.status === 'success').length;
  const getErrorCount = () => importResults.filter(r => r.status === 'error').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin: Bulk Import Sources
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {currentStep === 'input' && (
          <>
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  <p className="font-medium mb-1">Admin Feature:</p>
                  <p>Provide a URL that contains GitHub repository links in plain text. The system will automatically extract and import all repositories.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Source List URL
                </label>
                <div className="relative">
                  <Link className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    disabled={loading}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                    placeholder="https://example.com/music-sources.txt"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  URL should point to a text file containing GitHub repository URLs
                </p>
              </div>

              {error && (
                <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Import All Sources</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}

        {currentStep === 'processing' && (
          <div className="space-y-4">
            {progress && (
              <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <Loader className="h-5 w-5 animate-spin" />
                <span className="text-sm">{progress}</span>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {importResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {result.status === 'pending' && (
                      <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                    )}
                    {result.status === 'processing' && (
                      <Loader className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    {result.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {result.status === 'error' && (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {result.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {result.url}
                    </p>
                    {result.error && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {result.error}
                      </p>
                    )}
                    {result.status === 'success' && result.playlistCount && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {result.playlistCount} playlists imported
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'results' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Import Complete!
              </h3>
              <div className="flex justify-center space-x-6 text-sm">
                <div className="flex items-center space-x-1 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>{getSuccessCount()} successful</span>
                </div>
                <div className="flex items-center space-x-1 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  <span>{getErrorCount()} failed</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {importResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {result.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {result.status === 'error' && (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {result.name}
                    </p>
                    {result.error && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {result.error}
                      </p>
                    )}
                    {result.status === 'success' && result.playlistCount && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {result.playlistCount} playlists imported
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleFinish}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Finish
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBulkImportModal;