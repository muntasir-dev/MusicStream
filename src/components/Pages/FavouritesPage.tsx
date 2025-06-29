import React, { useState } from 'react';
import { Heart, Play, Music, Search, Trash2 } from 'lucide-react';
import { useMusic } from '../../contexts/MusicContext';

const FavouritesPage: React.FC = () => {
  const { favourites, play, removeFromFavourites } = useMusic();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFavourites = favourites.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleRemoveFavourite = (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    removeFromFavourites(songId);
  };

  return (
    <div className="p-6 pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Your Favourites
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Songs you've added to your favourites collection
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search favourite songs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Favourites List */}
        {filteredFavourites.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredFavourites.map((song, index) => (
                <div
                  key={song.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group"
                  onClick={() => play(song)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                      {song.cover_art_url ? (
                        <img
                          src={song.cover_art_url}
                          alt={song.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Music className="h-6 w-6 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {song.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Duration: {formatTime(song.duration)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => handleRemoveFavourite(e, song.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-all"
                        title="Remove from favourites"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button className="opacity-0 group-hover:opacity-100 text-purple-600 dark:text-purple-400 p-2 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900 transition-all">
                        <Play className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <Heart className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'No favourite songs found' : 'No favourite songs yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery 
                ? 'Try adjusting your search terms' 
                : 'Start adding songs to your favourites to see them here'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FavouritesPage;