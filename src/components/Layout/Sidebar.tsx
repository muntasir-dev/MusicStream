import React from 'react';
import { Home, Music, Heart, User, Settings, Plus } from 'lucide-react';
import { useMusic } from '../../contexts/MusicContext';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  onAddStreamingLink: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, onAddStreamingLink }) => {
  const { playlists, favourites } = useMusic();

  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'library', label: 'Library', icon: Music },
    { id: 'favourites', label: 'Favourites', icon: Heart, count: favourites.length },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-900 h-full border-r border-gray-200 dark:border-gray-700">
      <div className="p-4">
        {/* Main Navigation */}
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                currentPage === item.id
                  ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center space-x-3">
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && (
                <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Add Streaming Link Button */}
        <div className="mt-8">
          <button
            onClick={onAddStreamingLink}
            className="w-full flex items-center space-x-3 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Add Streaming Link</span>
          </button>
        </div>

        {/* Playlists Section */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Playlists
          </h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => onPageChange(`playlist-${playlist.id}`)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors truncate"
                title={playlist.name}
              >
                {playlist.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;