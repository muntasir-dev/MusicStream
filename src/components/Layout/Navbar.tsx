import React, { useState, useEffect } from 'react';
import { Search, User, Settings, Moon, Sun, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useMusic } from '../../contexts/MusicContext';
import { supabase } from '../../lib/supabase';

interface NavbarProps {
  onSearchResults: (results: any[]) => void;
  onNavigate: (page: string) => void;
}

interface SearchResult {
  id: string;
  title: string;
  type: 'song' | 'playlist';
  playlist_name?: string;
  duration?: number;
}

const Navbar: React.FC<NavbarProps> = ({ onSearchResults, onNavigate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [userProfile, setUserProfile] = useState<{ display_name: string; avatar_url?: string } | null>(null);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { play, playlists } = useMusic();

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (data) {
      setUserProfile(data);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      onSearchResults([]);
      return;
    }

    try {
      const results: SearchResult[] = [];

      // Search songs
      const { data: songsData } = await supabase
        .from('songs')
        .select(`
          id,
          title,
          duration,
          playlists!inner(
            name,
            user_id
          )
        `)
        .eq('playlists.user_id', user?.id)
        .ilike('title', `%${query}%`)
        .limit(10);

      if (songsData) {
        songsData.forEach(song => {
          results.push({
            id: song.id,
            title: song.title,
            type: 'song',
            playlist_name: song.playlists.name,
            duration: song.duration
          });
        });
      }

      // Search playlists
      const { data: playlistsData } = await supabase
        .from('playlists')
        .select('id, name')
        .eq('user_id', user?.id)
        .ilike('name', `%${query}%`)
        .limit(5);

      if (playlistsData) {
        playlistsData.forEach(playlist => {
          results.push({
            id: playlist.id,
            title: playlist.name,
            type: 'playlist'
          });
        });
      }

      setSearchResults(results);
      setShowSearchResults(true);
      onSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleSearchResultClick = async (result: SearchResult) => {
    if (result.type === 'song') {
      // Find and play the song
      const { data: songData } = await supabase
        .from('songs')
        .select('*')
        .eq('id', result.id)
        .single();

      if (songData) {
        play(songData);
      }
    } else if (result.type === 'playlist') {
      // Navigate to playlist
      onNavigate(`playlist-${result.id}`);
    }
    
    setShowSearchResults(false);
    setSearchQuery('');
  };

  const handleProfileClick = () => {
    setShowProfileMenu(false);
    onNavigate('profile');
  };

  const handleSettingsClick = () => {
    setShowProfileMenu(false);
    onNavigate('settings');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowProfileMenu(false);
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time) || time === 0) return '--:--';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                MusicStream
              </h1>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-8 relative">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search songs, playlists..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
              />
            </div>

            {/* Search Results Dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="py-2">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSearchResultClick(result)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-3"
                    >
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                        {result.type === 'song' ? (
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">♪</span>
                        ) : (
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">📁</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {result.title}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {result.type === 'song' 
                            ? `${result.playlist_name} • ${formatTime(result.duration || 0)}`
                            : 'Playlist'
                          }
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No Results */}
            {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                <div className="py-4 px-4 text-center text-gray-500 dark:text-gray-400">
                  No results found for "{searchQuery}"
                </div>
              </div>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            {/* Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-3 p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center overflow-hidden">
                  {userProfile?.avatar_url ? (
                    <img
                      src={userProfile.avatar_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5 text-gray-500" />
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium">
                    {userProfile?.display_name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div className="py-1">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {userProfile?.display_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user?.email}
                      </p>
                    </div>
                    <button
                      onClick={handleProfileClick}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </button>
                    <button
                      onClick={handleSettingsClick}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;