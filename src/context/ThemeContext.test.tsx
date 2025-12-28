import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';
import type { ReactNode } from 'react';

// Wrapper component for testing hooks
const wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('ThemeContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset document attribute
    document.documentElement.removeAttribute('data-theme');
  });

  describe('ThemeProvider', () => {
    it('renders children', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current).toBeDefined();
    });

    it('defaults to system theme', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.theme).toBe('system');
    });

    it('resolves system theme to light when prefers-color-scheme is light', () => {
      // matchMedia is mocked to return false for dark mode in setup.ts
      const { result } = renderHook(() => useTheme(), { wrapper });
      expect(result.current.resolvedTheme).toBe('light');
    });
  });

  describe('setTheme', () => {
    it('updates theme to light', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.theme).toBe('light');
      expect(result.current.resolvedTheme).toBe('light');
    });

    it('updates theme to dark', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('saves theme to localStorage', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(localStorage.getItem('clip-flow-theme')).toBe('dark');
    });

    it('applies data-theme attribute to document', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme('dark');
      });

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });
  });

  describe('toggleTheme', () => {
    it('toggles from light to dark', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      // First set to light
      act(() => {
        result.current.setTheme('light');
      });

      expect(result.current.resolvedTheme).toBe('light');

      // Then toggle
      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('toggles from dark to light', () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      // First set to dark
      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.resolvedTheme).toBe('dark');

      // Then toggle
      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
      expect(result.current.resolvedTheme).toBe('light');
    });
  });

  describe('localStorage persistence', () => {
    it('loads theme from localStorage on mount', () => {
      // Set theme in localStorage before mounting
      localStorage.setItem('clip-flow-theme', 'dark');

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('dark');
    });

    it('defaults to system if localStorage has invalid value', () => {
      localStorage.setItem('clip-flow-theme', 'invalid-theme');

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe('system');
    });
  });

  describe('useTheme hook', () => {
    it('throws error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });
  });
});
