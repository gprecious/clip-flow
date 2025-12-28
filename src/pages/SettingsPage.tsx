import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Select, SearchableSelect } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useSettings } from '@/context/SettingsContext';
import { supportedLanguages } from '@/i18n';
import { WHISPER_LANGUAGES } from '@/lib/constants/whisperLanguages';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { settings, setTranscriptionLanguage } = useSettings();

  const languageOptions = supportedLanguages.map((lang) => ({
    value: lang.code,
    label: lang.nativeName,
  }));

  const themeOptions = [
    { value: 'light', label: t('settings.themeLight', 'Light') },
    { value: 'dark', label: t('settings.themeDark', 'Dark') },
    { value: 'system', label: t('settings.themeSystem', 'System') },
  ];

  // Whisper transcription language options
  const whisperLanguageOptions = useMemo(() => {
    return WHISPER_LANGUAGES.map((lang) => ({
      value: lang.code,
      label: lang.code === 'auto'
        ? t('settings.autoDetect', 'Auto Detect')
        : `${lang.name} (${lang.nativeName})`,
      description: lang.code === 'auto'
        ? t('settings.autoDetectDesc', 'Automatically detect the spoken language')
        : undefined,
    }));
  }, [t]);

  return (
    <div className="p-6 space-y-6">
      {/* General Settings */}
      <Card title={t('settings.general', 'General')}>
        <div className="space-y-4">
          <Select
            label={t('settings.language', 'Language')}
            options={languageOptions}
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
          />

          <Select
            label={t('settings.theme', 'Theme')}
            options={themeOptions}
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
          />
        </div>
      </Card>

      {/* Transcription Settings */}
      <Card title={t('settings.transcription', 'Transcription')}>
        <div className="space-y-4">
          <SearchableSelect
            label={t('settings.transcriptionLanguage', 'Transcription Language')}
            options={whisperLanguageOptions}
            value={settings.transcriptionLanguage}
            onChange={setTranscriptionLanguage}
            placeholder={t('settings.selectLanguage', 'Select language...')}
            searchPlaceholder={t('settings.searchLanguage', 'Search language...')}
            helperText={t('settings.transcriptionLanguageHint', 'The language spoken in your media files')}
          />
        </div>
      </Card>

      {/* About Section */}
      <Card title={t('settings.about', 'About')}>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-neutral-600 dark:text-neutral-400">
              {t('settings.version', 'Version')}
            </span>
            <span className="text-neutral-900 dark:text-neutral-100">1.0.0</span>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-4">
            {t('settings.description', 'Clip-Flow helps you transcribe and organize your media files using AI.')}
          </p>
        </div>
      </Card>
    </div>
  );
}

export default SettingsPage;
