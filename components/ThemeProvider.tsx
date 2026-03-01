/**
 * ThemeProvider
 * Applies global theme state to the DOM root
 */

'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  useEffect(() => {
    // Apply theme to root element
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <>{children}</>;
}
