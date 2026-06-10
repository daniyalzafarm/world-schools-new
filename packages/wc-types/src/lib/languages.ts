/**
 * Canonical language dataset — single source of truth shared by the frontend
 * (ui-web builds the picker + render helpers on top of this) and the backend
 * (DTO validation + the data migration use `LANGUAGE_CODES` /
 * `LEGACY_LANGUAGE_ID_TO_CODE`).
 *
 * The canonical stored value is the ISO 639-1 code (e.g. "en"), with two
 * curated exceptions where 639-1 has no entry: "yue" (Cantonese) and "fil"
 * (Filipino). Names + flags are carried over from the product's curated list.
 */
export interface LanguageEntry {
  /** ISO 639-1 code (canonical stored value); "yue"/"fil" where 639-1 lacks one. */
  code: string
  /** English display name. */
  name: string
  /** Representative flag emoji. */
  flag: string
}

export const LANGUAGES: LanguageEntry[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese (Mandarin)', flag: '🇨🇳' },
  { code: 'yue', name: 'Cantonese', flag: '🇭🇰' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
  { code: 'no', name: 'Norwegian', flag: '🇳🇴' },
  { code: 'da', name: 'Danish', flag: '🇩🇰' },
  { code: 'fi', name: 'Finnish', flag: '🇫🇮' },
  { code: 'is', name: 'Icelandic', flag: '🇮🇸' },
  { code: 'ga', name: 'Irish', flag: '🇮🇪' },
  { code: 'el', name: 'Greek', flag: '🇬🇷' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'cs', name: 'Czech', flag: '🇨🇿' },
  { code: 'sk', name: 'Slovak', flag: '🇸🇰' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
  { code: 'bg', name: 'Bulgarian', flag: '🇧🇬' },
  { code: 'hr', name: 'Croatian', flag: '🇭🇷' },
  { code: 'sr', name: 'Serbian', flag: '🇷🇸' },
  { code: 'sl', name: 'Slovenian', flag: '🇸🇮' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦' },
  { code: 'lt', name: 'Lithuanian', flag: '🇱🇹' },
  { code: 'lv', name: 'Latvian', flag: '🇱🇻' },
  { code: 'et', name: 'Estonian', flag: '🇪🇪' },
  { code: 'sq', name: 'Albanian', flag: '🇦🇱' },
  { code: 'mt', name: 'Maltese', flag: '🇲🇹' },
  { code: 'ca', name: 'Catalan', flag: '🇪🇸' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', flag: '🇲🇾' },
  { code: 'fil', name: 'Filipino (Tagalog)', flag: '🇵🇭' },
  { code: 'km', name: 'Khmer', flag: '🇰🇭' },
  { code: 'my', name: 'Burmese', flag: '🇲🇲' },
  { code: 'ne', name: 'Nepali', flag: '🇳🇵' },
  { code: 'si', name: 'Sinhala', flag: '🇱🇰' },
  { code: 'mn', name: 'Mongolian', flag: '🇲🇳' },
  { code: 'fa', name: 'Persian (Farsi)', flag: '🇮🇷' },
  { code: 'he', name: 'Hebrew', flag: '🇮🇱' },
  { code: 'az', name: 'Azerbaijani', flag: '🇦🇿' },
  { code: 'hy', name: 'Armenian', flag: '🇦🇲' },
  { code: 'ka', name: 'Georgian', flag: '🇬🇪' },
  { code: 'sw', name: 'Swahili', flag: '🇰🇪' },
  { code: 'am', name: 'Amharic', flag: '🇪🇹' },
  { code: 'zu', name: 'Zulu', flag: '🇿🇦' },
  { code: 'af', name: 'Afrikaans', flag: '🇿🇦' },
]

/** All canonical language codes — used for backend `@IsIn` validation. */
export const LANGUAGE_CODES: string[] = LANGUAGES.map(language => language.code)

/**
 * Legacy lowercase form-state ids (and a couple of historical aliases) mapped to
 * the canonical ISO code. Used by the resilient render helpers and the one-off
 * data migration so existing values keep resolving / can be converted.
 */
export const LEGACY_LANGUAGE_ID_TO_CODE: Record<string, string> = {
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  dutch: 'nl',
  russian: 'ru',
  chinese: 'zh',
  mandarin: 'zh',
  cantonese: 'yue',
  japanese: 'ja',
  korean: 'ko',
  arabic: 'ar',
  hindi: 'hi',
  bengali: 'bn',
  urdu: 'ur',
  tamil: 'ta',
  polish: 'pl',
  swedish: 'sv',
  norwegian: 'no',
  danish: 'da',
  finnish: 'fi',
  icelandic: 'is',
  irish: 'ga',
  greek: 'el',
  turkish: 'tr',
  czech: 'cs',
  slovak: 'sk',
  hungarian: 'hu',
  romanian: 'ro',
  bulgarian: 'bg',
  croatian: 'hr',
  serbian: 'sr',
  slovenian: 'sl',
  ukrainian: 'uk',
  lithuanian: 'lt',
  latvian: 'lv',
  estonian: 'et',
  albanian: 'sq',
  maltese: 'mt',
  catalan: 'ca',
  thai: 'th',
  vietnamese: 'vi',
  indonesian: 'id',
  malay: 'ms',
  filipino: 'fil',
  tagalog: 'fil',
  khmer: 'km',
  burmese: 'my',
  nepali: 'ne',
  sinhala: 'si',
  mongolian: 'mn',
  persian: 'fa',
  hebrew: 'he',
  azerbaijani: 'az',
  armenian: 'hy',
  georgian: 'ka',
  swahili: 'sw',
  amharic: 'am',
  zulu: 'zu',
  afrikaans: 'af',
}
