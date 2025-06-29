import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Load user's theme preference from database
      const loadTheme = async () => {
        const { data } = await supabase
          .from('user_settings')
          .select('theme')
          .eq('user_id', user.id)
          .single();
        
        if (data?.theme) {
          setTheme(data.theme as 'light' | 'dark');
        }
      };
      loadTheme();
    } else {
      // Load theme from localStorage for non-authenticated users
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
      if (savedTheme) {
        setTheme(savedTheme);
      }
    }
  }, [user]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (!user) {
      localStorage.setItem('theme', theme);
    }
  }, [theme, user]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    if (user) {
      // Save to database
      await supabase
        .from('user_settings')
        .update({ theme: newTheme })
        .eq('user_id', user.id);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};