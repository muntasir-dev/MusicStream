import React, { useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  Shuffle, 
  Repeat, 
  Repeat1,
  Heart,
  Share,
  Music
} from 'lucide-react';
import { useMusic } from '../../contexts/MusicContext';

const MusicPlayer: React.FC = () => {
  const {
    currentSong,
    isPlaying,
    volume,
    currentTime,
    duration,
    isShuffled,
    loopMode,
    favourites,
    togglePlay,
    nextSong,
    previousSong,
    setVolume,
    seek,
    toggleShuffle,
    toggleLoop,
    addToFavourites,
    removeFromFavourites,
  } = useMusic();

  const titleRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scrolling text effect
  useEffect(() => {
    if (!currentSong || !titleRef.current || !containerRef.current) return;

    const titleElement = titleRef.current;
    const containerElement = containerRef.current;
    
    const titleWidth = titleElement.scrollWidth;
    const containerWidth = containerElement.clientWidth;
    
    if (titleWidth > containerWidth) {
      // Add scrolling animation
      titleElement.style.animation = 'none';
      titleElement.offsetHeight; // Trigger reflow
      titleElement.style.animation = `scroll-text ${Math.max(titleWidth / 30, 3)}s linear infinite`;
    } else {
      titleElement.style.animation = 'none';
    }
  }, [currentSong?.title]);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seek(percent * duration);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseInt(e.target.value));
  };

  const isFavourite = currentSong ? favourites.some(fav => fav.id === currentSong.id) : false;

  const handleFavouriteToggle = () => {
    if (!currentSong) return;
    
    if (isFavourite) {
      removeFromFavourites(currentSong.id);
    } else {
      addToFavourites(currentSong);
    }
  };

  const copyShareLink = async () => {
    if (!currentSong) return;
    
    try {
      await navigator.clipboard.writeText(currentSong.unique_link);
      // You might want to show a toast notification here
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  if (!currentSong) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-center text-gray-500 dark:text-gray-400">
          <Music className="h-6 w-6 mr-2" />
          <span>No song selected</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* CSS for scrolling animation */}
      <style>
        {`
          @keyframes scroll-text {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
          
          .scrolling-text-container {
            overflow: hidden;
            white-space: nowrap;
            position: relative;
          }
          
          .scrolling-text {
            display: inline-block;
            white-space: nowrap;
          }
        `}
      </style>

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg">
        <div className="max-w-7xl mx-auto">
          {/* Progress Bar */}
          <div className="mb-4">
            <div 
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer"
              onClick={handleProgressClick}
            >
              <div 
                className="h-full bg-purple-600 rounded-full transition-all duration-300"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {/* Song Info with Scrolling Text */}
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                {currentSong.cover_art_url ? (
                  <img 
                    src={currentSong.cover_art_url} 
                    alt={currentSong.title}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Music className="h-6 w-6 text-gray-500" />
                )}
              </div>
              <div className="min-w-0 flex-1 max-w-xs">
                <div 
                  ref={containerRef}
                  className="scrolling-text-container"
                >
                  <h3 
                    ref={titleRef}
                    className="scrolling-text font-medium text-gray-900 dark:text-white"
                  >
                    {currentSong.title}
                  </h3>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {duration ? formatTime(duration) : 'Loading...'}
                </p>
              </div>
            </div>

            {/* Player Controls */}
            <div className="flex items-center space-x-4 mx-8">
              <button
                onClick={toggleShuffle}
                className={`p-2 rounded-full transition-colors ${
                  isShuffled 
                    ? 'text-purple-600 bg-purple-100 dark:bg-purple-900' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Shuffle className="h-5 w-5" />
              </button>

              <button
                onClick={previousSong}
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <SkipBack className="h-6 w-6" />
              </button>

              <button
                onClick={togglePlay}
                className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition-colors shadow-lg"
              >
                {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
              </button>

              <button
                onClick={nextSong}
                className="p-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <SkipForward className="h-6 w-6" />
              </button>

              <button
                onClick={toggleLoop}
                className={`p-2 rounded-full transition-colors ${
                  loopMode !== 'off' 
                    ? 'text-purple-600 bg-purple-100 dark:bg-purple-900' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {loopMode === 'one' ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
              </button>
            </div>

            {/* Additional Controls */}
            <div className="flex items-center space-x-4 flex-1 justify-end">
              <button
                onClick={handleFavouriteToggle}
                className={`p-2 rounded-full transition-colors ${
                  isFavourite 
                    ? 'text-red-500 bg-red-100 dark:bg-red-900' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Heart className={`h-5 w-5 ${isFavourite ? 'fill-current' : ''}`} />
              </button>

              <button
                onClick={copyShareLink}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Copy share link"
              >
                <Share className="h-5 w-5" />
              </button>

              <div className="flex items-center space-x-2">
                <Volume2 className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MusicPlayer;