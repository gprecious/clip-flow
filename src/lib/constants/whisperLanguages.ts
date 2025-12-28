/**
 * All languages supported by OpenAI Whisper
 * https://github.com/openai/whisper/blob/main/whisper/tokenizer.py
 */
export interface WhisperLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export const WHISPER_LANGUAGES: WhisperLanguage[] = [
  { code: 'auto', name: 'Auto Detect', nativeName: '자동 감지' },
  { code: 'af', name: 'Afrikaans', nativeName: 'Afrikaans' },
  { code: 'am', name: 'Amharic', nativeName: 'አማርኛ' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া' },
  { code: 'az', name: 'Azerbaijani', nativeName: 'Azərbaycan' },
  { code: 'ba', name: 'Bashkir', nativeName: 'Башҡорт' },
  { code: 'be', name: 'Belarusian', nativeName: 'Беларуская' },
  { code: 'bg', name: 'Bulgarian', nativeName: 'Български' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'bo', name: 'Tibetan', nativeName: 'བོད་སྐད' },
  { code: 'br', name: 'Breton', nativeName: 'Brezhoneg' },
  { code: 'bs', name: 'Bosnian', nativeName: 'Bosanski' },
  { code: 'ca', name: 'Catalan', nativeName: 'Català' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština' },
  { code: 'cy', name: 'Welsh', nativeName: 'Cymraeg' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'et', name: 'Estonian', nativeName: 'Eesti' },
  { code: 'eu', name: 'Basque', nativeName: 'Euskara' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
  { code: 'fo', name: 'Faroese', nativeName: 'Føroyskt' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'gl', name: 'Galician', nativeName: 'Galego' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
  { code: 'ha', name: 'Hausa', nativeName: 'Hausa' },
  { code: 'haw', name: 'Hawaiian', nativeName: 'ʻŌlelo Hawaiʻi' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski' },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen' },
  { code: 'hu', name: 'Hungarian', nativeName: 'Magyar' },
  { code: 'hy', name: 'Armenian', nativeName: 'Հայերեն' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'is', name: 'Icelandic', nativeName: 'Íslenska' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'jw', name: 'Javanese', nativeName: 'Basa Jawa' },
  { code: 'ka', name: 'Georgian', nativeName: 'ქართული' },
  { code: 'kk', name: 'Kazakh', nativeName: 'Қазақша' },
  { code: 'km', name: 'Khmer', nativeName: 'ភាសាខ្មែរ' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'la', name: 'Latin', nativeName: 'Latina' },
  { code: 'lb', name: 'Luxembourgish', nativeName: 'Lëtzebuergesch' },
  { code: 'ln', name: 'Lingala', nativeName: 'Lingála' },
  { code: 'lo', name: 'Lao', nativeName: 'ລາວ' },
  { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių' },
  { code: 'lv', name: 'Latvian', nativeName: 'Latviešu' },
  { code: 'mg', name: 'Malagasy', nativeName: 'Malagasy' },
  { code: 'mi', name: 'Maori', nativeName: 'Te Reo Māori' },
  { code: 'mk', name: 'Macedonian', nativeName: 'Македонски' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'mn', name: 'Mongolian', nativeName: 'Монгол' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu' },
  { code: 'mt', name: 'Maltese', nativeName: 'Malti' },
  { code: 'my', name: 'Burmese', nativeName: 'မြန်မာစာ' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'nn', name: 'Norwegian Nynorsk', nativeName: 'Nynorsk' },
  { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
  { code: 'oc', name: 'Occitan', nativeName: 'Occitan' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'ps', name: 'Pashto', nativeName: 'پښتو' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ro', name: 'Romanian', nativeName: 'Română' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي' },
  { code: 'si', name: 'Sinhala', nativeName: 'සිංහල' },
  { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina' },
  { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina' },
  { code: 'sn', name: 'Shona', nativeName: 'ChiShona' },
  { code: 'so', name: 'Somali', nativeName: 'Soomaali' },
  { code: 'sq', name: 'Albanian', nativeName: 'Shqip' },
  { code: 'sr', name: 'Serbian', nativeName: 'Српски' },
  { code: 'su', name: 'Sundanese', nativeName: 'Basa Sunda' },
  { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
  { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'tg', name: 'Tajik', nativeName: 'Тоҷикӣ' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'tk', name: 'Turkmen', nativeName: 'Türkmen' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
  { code: 'tt', name: 'Tatar', nativeName: 'Татар' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
  { code: 'uz', name: 'Uzbek', nativeName: 'Oʻzbek' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'yi', name: 'Yiddish', nativeName: 'ייִדיש' },
  { code: 'yo', name: 'Yoruba', nativeName: 'Yorùbá' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

/**
 * Get language by code
 */
export function getWhisperLanguage(code: string): WhisperLanguage | undefined {
  return WHISPER_LANGUAGES.find((lang) => lang.code === code);
}

/**
 * Get display label for a language (includes native name)
 */
export function getWhisperLanguageLabel(code: string, showNative: boolean = true): string {
  const lang = getWhisperLanguage(code);
  if (!lang) return code;
  if (!showNative || lang.name === lang.nativeName) return lang.name;
  return `${lang.name} (${lang.nativeName})`;
}
