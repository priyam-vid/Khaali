'use client';

import { useState, useEffect, useCallback } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Theme Initialization & Sync
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('khaali_theme') as 'dark' | 'light' | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.classList.toggle('light', savedTheme === 'light');
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
        document.documentElement.classList.add('light');
        document.documentElement.classList.remove('dark');
      } else {
        setTheme('dark');
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      }
    } catch {
      // Ignore
    }
  }, []);

  const setThemeMode = useCallback((newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    try {
      localStorage.setItem('khaali_theme', newTheme);
    } catch {
      // Ignore
    }
  }, []);

  return { theme, setThemeMode };
}
