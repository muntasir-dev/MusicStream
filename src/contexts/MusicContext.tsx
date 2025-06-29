import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

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
  user_id: string;
  source_id: string;
}

interface MusicContextType {
  currentSong: Song | null;
  currentPlaylist: Song[];
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  isShuffled: boolean;
  loopMode: 'off' | 'one' | 'all';
  playlists: Playlist[];
  favourites: Song[];
  play: (song?: Song) => void;
  pause: () => void;
  togglePlay: () => void;
  nextSong: () => void;
  previousSong: () => void;
  setVolume: (volume: number) => void;
  seek: (time: number) => void;
  toggleShuffle: () => void;
  toggleLoop: () => void;
  addToFavourites: (song: Song) => void;
  removeFromFavourites: (songId: string) => void;
  loadPlaylist: (playlistId: string) => Promise<void>;
  loadPlaylists: () => Promise<void>;
  searchSongs: (query: string) => Song[];
  setCurrentPlaylist: (songs: Song[]) => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentPlaylist, setCurrentPlaylistState] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(50);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffled, setIsShuffled] = useState(false);
  const [loopMode, setLoopMode] = useState<'off' | 'one' | 'all'>('off');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favourites, setFavourites] = useState<Song[]>([]);
  const [allSongs, setAllSongs] = useState<Song[]>([]);

  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const { user } = useAuth();

  // Load playlists and songs
  useEffect(() => {
    if (user) {
      loadPlaylists();
      loadFavourites();
      loadUserSettings();
    }
  }, [user]);

  // Handle audio playback when currentSong or isPlaying changes
  useEffect(() => {
    const audio = audioRef.current;
    
    if (currentSong && isPlaying) {
      // If the current audio source is different from the new song, load the new song
      if (audio.src !== currentSong.file_path) {
        audio.src = currentSong.file_path;
        setCurrentTime(0);
        setDuration(0);
        audio.load();
        
        // Wait for the audio to be ready before playing
        const handleCanPlayThrough = () => {
          audio.play().catch(error => {
            console.error('Error playing audio:', error);
            setIsPlaying(false);
          });
          audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        };
        
        audio.addEventListener('canplaythrough', handleCanPlayThrough);
      } else {
        // Same song, just resume playback
        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
        });
      }
    } else if (!isPlaying) {
      audio.pause();
    }
  }, [currentSong, isPlaying]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => {
      setDuration(audio.duration);
      // Update song duration in database if it's different
      if (currentSong && audio.duration && Math.abs(audio.duration - currentSong.duration) > 5) {
        updateSongDuration(currentSong.id, Math.floor(audio.duration));
      }
    };
    const handleEnded = () => {
      if (loopMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(error => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
        });
      } else {
        nextSong();
      }
    };
    const handleLoadStart = () => {
      setCurrentTime(0);
      setDuration(0);
    };
    const handleCanPlay = () => {
      setDuration(audio.duration || 0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [loopMode, currentSong]);

  // Volume control
  useEffect(() => {
    audioRef.current.volume = volume / 100;
  }, [volume]);

  const updateSongDuration = async (songId: string, newDuration: number) => {
    try {
      await supabase
        .from('songs')
        .update({ duration: newDuration })
        .eq('id', songId);
      
      // Update local state
      setAllSongs(prev => prev.map(song => 
        song.id === songId ? { ...song, duration: newDuration } : song
      ));
      setCurrentPlaylistState(prev => prev.map(song => 
        song.id === songId ? { ...song, duration: newDuration } : song
      ));
      if (currentSong?.id === songId) {
        setCurrentSong(prev => prev ? { ...prev, duration: newDuration } : null);
      }
    } catch (error) {
      console.error('Error updating song duration:', error);
    }
  };

  const loadUserSettings = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setVolumeState(data.volume || 50);
      setIsShuffled(data.shuffle_mode || false);
      setLoopMode(data.loop_mode || 'off');
    }
  };

  const loadPlaylists = async () => {
    if (!user) return;

    try {
      // Load user's playlists (from any shared source)
      const { data: playlistData } = await supabase
        .from('playlists')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (playlistData) {
        setPlaylists(playlistData);
        
        // Load all songs from user's playlists
        const { data: songsData } = await supabase
          .from('songs')
          .select('*')
          .in('playlist_id', playlistData.map(p => p.id))
          .order('title');
        
        if (songsData) {
          setAllSongs(songsData);
        }
      }
    } catch (error) {
      console.error('Error loading playlists:', error);
    }
  };

  const loadFavourites = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('user_favourites')
      .select(`
        songs (
          id,
          title,
          duration,
          file_path,
          cover_art_url,
          unique_link,
          playlist_id
        )
      `)
      .eq('user_id', user.id);

    if (data) {
      const favSongs = data.map(item => item.songs).filter(Boolean) as Song[];
      setFavourites(favSongs);
    }
  };

  const play = (song?: Song) => {
    if (song) {
      setCurrentSong(song);
    }
    setIsPlaying(true);
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const nextSong = () => {
    if (currentPlaylist.length === 0 || !currentSong) return;

    const currentIndex = currentPlaylist.findIndex(song => song.id === currentSong.id);
    let nextIndex;

    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * currentPlaylist.length);
    } else {
      nextIndex = (currentIndex + 1) % currentPlaylist.length;
    }

    if (loopMode === 'all' || nextIndex !== 0 || currentIndex !== currentPlaylist.length - 1) {
      play(currentPlaylist[nextIndex]);
    }
  };

  const previousSong = () => {
    if (currentPlaylist.length === 0 || !currentSong) return;

    const currentIndex = currentPlaylist.findIndex(song => song.id === currentSong.id);
    const prevIndex = currentIndex === 0 ? currentPlaylist.length - 1 : currentIndex - 1;
    
    play(currentPlaylist[prevIndex]);
  };

  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
    if (user) {
      supabase
        .from('user_settings')
        .update({ volume: newVolume })
        .eq('user_id', user.id);
    }
  };

  const seek = (time: number) => {
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const toggleShuffle = () => {
    const newShuffled = !isShuffled;
    setIsShuffled(newShuffled);
    if (user) {
      supabase
        .from('user_settings')
        .update({ shuffle_mode: newShuffled })
        .eq('user_id', user.id);
    }
  };

  const toggleLoop = () => {
    const modes: ('off' | 'one' | 'all')[] = ['off', 'one', 'all'];
    const currentIndex = modes.indexOf(loopMode);
    const newMode = modes[(currentIndex + 1) % modes.length];
    setLoopMode(newMode);
    if (user) {
      supabase
        .from('user_settings')
        .update({ loop_mode: newMode })
        .eq('user_id', user.id);
    }
  };

  const addToFavourites = async (song: Song) => {
    if (!user) return;

    const { error } = await supabase
      .from('user_favourites')
      .insert([{ user_id: user.id, song_id: song.id }]);

    if (!error) {
      setFavourites(prev => [...prev, song]);
    }
  };

  const removeFromFavourites = async (songId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('user_favourites')
      .delete()
      .eq('user_id', user.id)
      .eq('song_id', songId);

    if (!error) {
      setFavourites(prev => prev.filter(song => song.id !== songId));
    }
  };

  const loadPlaylist = async (playlistId: string): Promise<void> => {
    try {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('playlist_id', playlistId)
        .order('title');

      if (data && data.length > 0) {
        setCurrentPlaylistState(data);
        // Auto-play first song
        play(data[0]);
      }
    } catch (error) {
      console.error('Error loading playlist:', error);
    }
  };

  const setCurrentPlaylist = (songs: Song[]) => {
    setCurrentPlaylistState(songs);
  };

  const searchSongs = (query: string): Song[] => {
    return allSongs.filter(song =>
      song.title.toLowerCase().includes(query.toLowerCase())
    );
  };

  const value = {
    currentSong,
    currentPlaylist,
    isPlaying,
    volume,
    currentTime,
    duration,
    isShuffled,
    loopMode,
    playlists,
    favourites,
    play,
    pause,
    togglePlay,
    nextSong,
    previousSong,
    setVolume,
    seek,
    toggleShuffle,
    toggleLoop,
    addToFavourites,
    removeFromFavourites,
    loadPlaylist,
    loadPlaylists,
    searchSongs,
    setCurrentPlaylist,
  };

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
};