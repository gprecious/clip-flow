import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';
import type { ReactNode } from 'react';

// Wrapper component for testing hooks
const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('SettingsProvider', () => {
    it('renders children', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });
      expect(result.current).toBeDefined();
    });

    it('provides default settings', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings).toEqual({
        transcriptionProvider: 'local',
        transcriptionLanguage: 'auto',
        whisperModel: 'base',
        llmProvider: 'ollama',
        ollamaModel: 'llama3.2',
        openaiModel: 'gpt-4o',
        claudeModel: 'claude-3-5-sonnet-latest',
      });
    });
  });

  describe('updateSettings', () => {
    it('merges partial settings updates', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({ transcriptionLanguage: 'ko' });
      });

      expect(result.current.settings.transcriptionLanguage).toBe('ko');
      // Other settings should remain unchanged
      expect(result.current.settings.transcriptionProvider).toBe('local');
    });

    it('saves settings to localStorage', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.updateSettings({ transcriptionLanguage: 'en' });
      });

      const stored = JSON.parse(localStorage.getItem('clip-flow-settings') || '{}');
      expect(stored.transcriptionLanguage).toBe('en');
    });
  });

  describe('setTranscriptionProvider', () => {
    it('updates transcription provider to local', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setTranscriptionProvider('openai');
      });

      expect(result.current.settings.transcriptionProvider).toBe('openai');

      act(() => {
        result.current.setTranscriptionProvider('local');
      });

      expect(result.current.settings.transcriptionProvider).toBe('local');
    });
  });

  describe('setTranscriptionLanguage', () => {
    it('updates transcription language', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setTranscriptionLanguage('ko');
      });

      expect(result.current.settings.transcriptionLanguage).toBe('ko');
    });
  });

  describe('setWhisperModel', () => {
    it('updates whisper model', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setWhisperModel('medium');
      });

      expect(result.current.settings.whisperModel).toBe('medium');
    });
  });

  describe('setLLMProvider', () => {
    it('updates LLM provider', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setLLMProvider('openai');
      });

      expect(result.current.settings.llmProvider).toBe('openai');
    });
  });

  describe('setOllamaModel', () => {
    it('updates Ollama model', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setOllamaModel('mistral');
      });

      expect(result.current.settings.ollamaModel).toBe('mistral');
    });
  });

  describe('setOpenaiModel', () => {
    it('updates OpenAI model', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setOpenaiModel('gpt-4');
      });

      expect(result.current.settings.openaiModel).toBe('gpt-4');
    });
  });

  describe('setClaudeModel', () => {
    it('updates Claude model', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setClaudeModel('claude-3-opus');
      });

      expect(result.current.settings.claudeModel).toBe('claude-3-opus');
    });
  });

  describe('language change detection', () => {
    it('hasLanguageChanged returns false on first run (no previous language)', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.hasLanguageChanged()).toBe(false);
    });

    it('hasLanguageChanged returns true when language differs from stored', () => {
      // Store a previous language
      localStorage.setItem('clip-flow-last-transcription-language', 'en');

      const { result } = renderHook(() => useSettings(), { wrapper });

      // Change to a different language
      act(() => {
        result.current.setTranscriptionLanguage('ko');
      });

      expect(result.current.hasLanguageChanged()).toBe(true);
    });

    it('hasLanguageChanged returns false when language matches stored', () => {
      localStorage.setItem('clip-flow-last-transcription-language', 'auto');

      const { result } = renderHook(() => useSettings(), { wrapper });

      // Default language is 'auto', same as stored
      expect(result.current.hasLanguageChanged()).toBe(false);
    });

    it('markLanguageAsUsed saves current language', () => {
      const { result } = renderHook(() => useSettings(), { wrapper });

      act(() => {
        result.current.setTranscriptionLanguage('ko');
      });

      act(() => {
        result.current.markLanguageAsUsed();
      });

      expect(localStorage.getItem('clip-flow-last-transcription-language')).toBe('ko');
    });
  });

  describe('localStorage persistence', () => {
    it('loads settings from localStorage on mount', () => {
      const storedSettings = {
        transcriptionProvider: 'openai',
        transcriptionLanguage: 'ko',
        whisperModel: 'medium',
      };
      localStorage.setItem('clip-flow-settings', JSON.stringify(storedSettings));

      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.transcriptionProvider).toBe('openai');
      expect(result.current.settings.transcriptionLanguage).toBe('ko');
      expect(result.current.settings.whisperModel).toBe('medium');
      // Non-stored settings should use defaults
      expect(result.current.settings.llmProvider).toBe('ollama');
    });

    it('handles invalid JSON in localStorage gracefully', () => {
      localStorage.setItem('clip-flow-settings', 'invalid-json');

      // Should not throw and use defaults
      const { result } = renderHook(() => useSettings(), { wrapper });

      expect(result.current.settings.transcriptionProvider).toBe('local');
    });
  });

  describe('useSettings hook', () => {
    it('throws error when used outside SettingsProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useSettings());
      }).toThrow('useSettings must be used within a SettingsProvider');

      consoleSpy.mockRestore();
    });
  });
});
