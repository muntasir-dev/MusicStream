import React, { useState, useEffect } from 'react';
import { Play, Pause, Music, Heart, ArrowLeft, Share, Clock } from 'lucide-react';
import { useMusic } from '../../contexts/MusicContext';
import { supabase } from '../../lib/supabase';

interface PlaylistPageProps {
  playlistId: string;
  onBack: () => void;
}

interface Song {
  id: string;
  title: string;
  duration: number;
  file_path: string;
  cover_art_url: string | null;
  unique_link: string;
  playlist_id: string;
}

interface Playlist {
  id: string;
  name: string;
  folder_path: string;
}

const PlaylistPage: React.FC<PlaylistPageProps> = ({ playlistId, onBack }) => {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const { 
    currentSong, 
    isPlaying, 
    play, 
    pause,
    favourites,
    addToFavourites,
    removeFromFavourites,
    setCurrentPlaylist
  } = useMusic();

  useEffect(() => {
    loadPlaylistData();
  }, [playlistId]);

  const loadPlaylistData = async () => {
    setLoading(true);
    try {
      // Load playlist info
      const { data: playlistData, error: playlistError } = await supabase
        .from('playlists')
        .select('*')
        .eq('id', playlistId)
        .single();

      if (playlistError) throw playlistError;
      setPlaylist(playlistData);

      // Load songs in playlist
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('title');

      if (songsError) throw songsError;
      setSongs(songsData || []);
      
      // Set current playlist for music player
      setCurrentPlaylist(songsData || []);
    } catch (error) {
      console.error('Error loading playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaySong = (song: Song) => {
    play(song);
  };

  const handlePlayAll = () => {
    if (songs.length > 0) {
      play(songs[0]);
    }
  };

  const handleTogglePlay = (song: Song) => {
    if (currentSong?.id === song.id) {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    } else {
      play(song);
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time) || time === 0) return '--:--';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTotalDuration = () => {
    const total = songs.reduce((acc, song) => acc + (song.duration || 0), 0);
    return formatTime(total);
  };

  const isFavourite = (songId: string) => {
    return favourites.some(fav => fav.id === songId);
  };

  const handleFavouriteToggle = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    if (isFavourite(song.id)) {
      removeFromFavourites(song.id);
    } else {
      addToFavourites(song);
    }
  };

  const copyShareLink = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(song.unique_link);
      // You might want to show a toast notification here
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="p-6 pb-32">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Playlist not found
          </h1>
          <button
            onClick={onBack}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 pb-32">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 hover:underline mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Library</span>
          </button>
          
          <div className="flex items-center space-x-6">
            <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center">
              <Music className="h-16 w-16 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {playlist.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {songs.length} song{songs.length !== 1 ? 's' : ''}
              </p>
              <div className="flex items-center space-x-4">
                <button
                  onClick={handlePlayAll}
                  disabled={songs.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-6 py-3 rounded-full flex items-center space-x-2 transition-colors"
                >
                  <Play className="h-5 w-5" />
                  <span>Play All</span>
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Total: {getTotalDuration()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Songs List */}
        {songs.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            {/* Table Header */}
            <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                <div className="col-span-1">#</div>
                <div className="col-span-6">Title</div>
                <div className="col-span-2 flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  Duration
                </div>
                <div className="col-span-3">Actions</div>
              </div>
            </div>

            {/* Songs */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {songs.map((song, index) => (
                <div
                  key={song.id}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group"
                  onClick={() => handlePlaySong(song)}
                >
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-1">
                      <div className="flex items-center justify-center w-8 h-8">
                        {currentSong?.id === song.id ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePlay(song);
                            }}
                            className="text-purple-600 dark:text-purple-400"
                          >
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                        ) : (
                          <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:hidden">
                            {index + 1}
                          </span>
                        )}
                        {currentSong?.id !== song.id && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlaySong(song);
                            }}
                            className="hidden group-hover:block text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="col-span-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                          {song.cover_art_url ? (
                            <img
                              src={song.cover_art_url}
                              alt={song.title}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <Music className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <h3 className={`font-medium truncate ${
                            currentSong?.id === song.id 
                              ? 'text-purple-600 dark:text-purple-400' 
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {song.title}
                          </h3>
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-span-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatTime(song.duration)}
                      </span>
                    </div>
                    
                    <div className="col-span-3">
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleFavouriteToggle(e, song)}
                          className={`p-2 rounded-full transition-colors ${
                            isFavourite(song.id)
                              ? 'text-red-500 bg-red-100 dark:bg-red-900'
                              : 'text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900'
                          }`}
                          title={isFavourite(song.id) ? 'Remove from favourites' : 'Add to favourites'}
                        >
                          <Heart className={`h-4 w-4 ${isFavourite(song.id) ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => copyShareLink(e, song)}
                          className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
                          title="Copy share link"
                        >
                          <Share className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Music className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No songs found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              This playlist doesn't contain any songs yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistPage;