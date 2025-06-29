import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { MusicProvider } from './contexts/MusicContext';
import Navbar from './components/Layout/Navbar';
import Sidebar from './components/Layout/Sidebar';
import MusicPlayer from './components/Player/MusicPlayer';
import AuthModal from './components/Auth/AuthModal';
import AddStreamingLinkModal from './components/Modals/AddStreamingLinkModal';
import HomePage from './components/Pages/HomePage';
import LibraryPage from './components/Pages/LibraryPage';
import PlaylistPage from './components/Pages/PlaylistPage';
import FavouritesPage from './components/Pages/FavouritesPage';
import ProfilePage from './components/Pages/ProfilePage';
import SettingsPage from './components/Pages/SettingsPage';

const AppContent: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      // Show add streaming link modal for new users
      const hasSeenModal = localStorage.getItem(`addLinkModal_${user.id}`);
      if (!hasSeenModal) {
        setShowAddLinkModal(true);
      }
    }
  }, [user, loading]);

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
  };

  const handleAddLinkSuccess = () => {
    if (user) {
      localStorage.setItem(`addLinkModal_${user.id}`, 'true');
    }
    setShowAddLinkModal(false);
  };

  const handleAddStreamingLink = () => {
    if (!user) {
      setShowAuthModal(true);
    } else {
      setShowAddLinkModal(true);
    }
  };

  const handleBackToLibrary = () => {
    setCurrentPage('library');
  };

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'library':
        return <LibraryPage onPlaylistSelect={(playlistId) => setCurrentPage(`playlist-${playlistId}`)} />;
      case 'favourites':
        return <FavouritesPage />;
      case 'profile':
        return <ProfilePage />;
      case 'settings':
        return <SettingsPage />;
      default:
        if (currentPage.startsWith('playlist-')) {
          const playlistId = currentPage.replace('playlist-', '');
          return <PlaylistPage playlistId={playlistId} onBack={handleBackToLibrary} />;
        }
        return <HomePage />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-5xl font-bold mb-4">MusicStream</h1>
          <p className="text-xl mb-8 opacity-90">Your personal music streaming platform</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Get Started
          </button>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Navbar onSearchResults={setSearchResults} onNavigate={handleNavigate} />
      
      <div className="flex">
        <Sidebar
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onAddStreamingLink={handleAddStreamingLink}
        />
        
        <main className="flex-1">
          {renderCurrentPage()}
        </main>
      </div>

      <MusicPlayer />

      <AddStreamingLinkModal
        isOpen={showAddLinkModal}
        onClose={() => setShowAddLinkModal(false)}
        onSuccess={handleAddLinkSuccess}
      />
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <MusicProvider>
            <AppContent />
          </MusicProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;