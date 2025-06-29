import React, { useState } from 'react';
import { X, Link, AlertCircle, HelpCircle, Github, Loader } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicContext';
import { supabase } from '../../lib/supabase';
import { GitHubService } from '../../services/githubService';

interface AddStreamingLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddStreamingLinkModal: React.FC<AddStreamingLinkModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  const [name, setName] = useState('');
  const [githubLink, setGithubLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const { user } = useAuth();
  const { loadPlaylists } = useMusic();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    setProgress('Validating repository...');

    try {
      // Validate GitHub URL format
      const githubUrlPattern = /^https:\/\/github\.com\/[\w\-\.]+\/[\w\-\.]+/;
      if (!githubUrlPattern.test(githubLink.trim())) {
        throw new Error('Please enter a valid GitHub repository URL');
      }

      // Parse GitHub URL
      const repoInfo = GitHubService.parseGitHubUrl(githubLink.trim());
      if (!repoInfo) {
        throw new Error('Invalid GitHub repository URL format');
      }

      // Check if user already has playlists from this repository
      setProgress('Checking if you already have this repository...');
      const { data: existingSources } = await supabase
        .from('streaming_sources')
        .select(`
          id,
          name,
          playlists!inner(
            id,
            user_id
          )
        `)
        .eq('drive_link', githubLink.trim())
        .eq('playlists.user_id', user.id);

      if (existingSources && existingSources.length > 0) {
        throw new Error('You have already added this repository to your library');
      }

      // Find or create the streaming source
      setProgress('Setting up repository source...');
      let sourceData;
      const { data: allExistingSources } = await supabase
        .from('streaming_sources')
        .select('id, name')
        .eq('drive_link', githubLink.trim());

      if (allExistingSources && allExistingSources.length > 0) {
        // Source exists, use the existing one
        sourceData = allExistingSources[0];
        setProgress('Using existing repository source...');
      } else {
        // Create new streaming source
        setProgress('Creating new repository source...');
        const { data: newSourceData, error: sourceError } = await supabase
          .from('streaming_sources')
          .insert([
            {
              name: name.trim(),
              drive_link: githubLink.trim(),
              created_by: user.id,
              last_synced: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (sourceError) throw sourceError;
        sourceData = newSourceData;
      }

      setProgress('Scanning repository structure...');

      // Scan repository for playlists and songs
      const { playlists } = await GitHubService.scanRepositoryStructure(
        repoInfo.owner, 
        repoInfo.repo
      );

      if (playlists.length === 0) {
        throw new Error('No audio files found in repository. Make sure your repository contains folders with audio files.');
      }

      setProgress(`Found ${playlists.length} playlists. Creating your personal library...`);

      let totalSongsCreated = 0;
      let totalPlaylistsCreated = 0;

      // Create playlists and songs for the current user
      for (const playlist of playlists) {
        setProgress(`Creating playlist: ${playlist.name}...`);

        // Create playlist for current user
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

        totalPlaylistsCreated++;

        // Create songs for this playlist
        if (playlist.songs.length > 0) {
          setProgress(`Adding ${playlist.songs.length} songs to ${playlist.name}...`);

          for (const song of playlist.songs) {
            const uniqueLink = GitHubService.generateUniqueLink(
              repoInfo.owner,
              repoInfo.repo,
              song.path
            );

            try {
              // Always create a new song for this user's playlist
              // Each user gets their own copy of songs
              const songData = {
                playlist_id: playlistData.id,
                title: song.name,
                duration: 180, // Default duration
                file_path: song.downloadUrl,
                unique_link: `${uniqueLink}_${user.id}_${Date.now()}`, // Make unique per user
              };

              const { error: songError } = await supabase
                .from('songs')
                .insert([songData]);

              if (songError) {
                console.error('Error creating song:', songError);
              } else {
                totalSongsCreated++;
              }
            } catch (songError) {
              console.error(`Error adding song ${song.name}:`, songError);
              // Continue with other songs even if one fails
            }
          }
        }
      }

      setProgress('Refreshing library...');
      
      // Refresh the music context
      await loadPlaylists();

      setProgress('Complete!');
      
      alert(`Successfully added ${totalPlaylistsCreated} playlists with ${totalSongsCreated} songs to your library!`);
      
      onSuccess();
      onClose();
      setName('');
      setGithubLink('');
    } catch (err: any) {
      setError(err.message || 'Failed to add streaming source');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const handleWatchTutorial = () => {
    // This will be updated with the actual YouTube tutorial link
    window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Add Music Repository
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">How to add your music library:</p>
              <p>Share your GitHub repository containing your music collection. You'll get your own copy of the playlists and songs.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collection Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              placeholder="e.g., My Music Library"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              GitHub Repository URL
            </label>
            <div className="relative">
              <Github className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="url"
                value={githubLink}
                onChange={(e) => setGithubLink(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                placeholder="https://github.com/username/music-repo"
                required
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Make sure your repository is public and contains music files organized in folders
            </p>
          </div>

          {progress && (
            <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
              <Loader className="h-5 w-5 animate-spin" />
              <span className="text-sm">{progress}</span>
            </div>
          )}

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
                <span>Add Repository</span>
              )}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={loading}
              className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Skip
            </button>
          </div>

          <button
            type="button"
            onClick={handleWatchTutorial}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            Watch Tutorial
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddStreamingLinkModal;