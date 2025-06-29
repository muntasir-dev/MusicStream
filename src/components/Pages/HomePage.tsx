import React from 'react';
import { Play, Music, Heart, Users, Search } from 'lucide-react';
import { useMusic } from '../../contexts/MusicContext';

const HomePage: React.FC = () => {
  const { playlists, favourites, loadPlaylist, setCurrentPlaylist } = useMusic();

  const handlePlayPlaylist = async (playlistId: string) => {
    try {
      await loadPlaylist(playlistId);
    } catch (error) {
      console.error('Error loading playlist:', error);
    }
  };

  const recentPlaylists = playlists.slice(0, 6);
  const popularSongs = favourites.slice(0, 8);

  return (
    <div className="p-6 pb-32">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Discover and enjoy your music collection
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Total Playlists</p>
                <p className="text-2xl font-bold">{playlists.length}</p>
              </div>
              <Music className="h-8 w-8 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-pink-500 to-pink-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-100">Favourites</p>
                <p className="text-2xl font-bold">{favourites.length}</p>
              </div>
              <Heart className="h-8 w-8 text-pink-200" />
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Songs</p>
                <p className="text-2xl font-bold">{favourites.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-200" />
            </div>
          </div>
        </div>

        {/* Recent Playlists */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Recent Playlists
            </h2>
            <button className="text-purple-600 dark:text-purple-400 hover:underline">
              View All
            </button>
          </div>

          {recentPlaylists.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentPlaylists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center">
                      <Music className="h-6 w-6 text-white" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayPlaylist(playlist.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-full transition-all shadow-lg"
                      title="Play playlist"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-white truncate">
                    {playlist.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {playlist.folder_path}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Music className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No playlists yet. Add a GitHub repository to get started!
              </p>
            </div>
          )}
        </div>

        {/* Popular Songs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Your Favourites
            </h2>
            <button className="text-purple-600 dark:text-purple-400 hover:underline">
              View All
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            {popularSongs.length > 0 ? (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {popularSongs.map((song, index) => (
                  <div
                    key={song.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                        {song.cover_art_url ? (
                          <img
                            src={song.cover_art_url}
                            alt={song.title}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Music className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {song.title}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {song.duration && song.duration > 0 
                            ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}`
                            : '--:--'
                          }
                        </p>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 text-purple-600 dark:text-purple-400 p-2 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900 transition-all">
                        <Play className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No favourite songs yet</p>
                <p className="text-sm mt-1">Add songs to your favourites to see them here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;