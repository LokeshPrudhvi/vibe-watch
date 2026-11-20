/** Original languages offered as Search chips, Indian languages first. */
export const SEARCH_LANGUAGES = [
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "ml", label: "Malayalam" },
  { code: "kn", label: "Kannada" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
  { code: "pa", label: "Punjabi" },
  { code: "en", label: "English" },
  { code: "ko", label: "Korean" },
  { code: "ja", label: "Japanese" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
] as const;

/** Industry nicknames people actually type. */
const ALIASES: Record<string, string> = {
  bollywood: "hi",
  kollywood: "ta",
  tollywood: "te",
  mollywood: "ml",
  sandalwood: "kn",
  hollywood: "en",
};

/**
 * "tamil", "Malayalam movies", "bollywood films" → the language code; anything else → undefined.
 * Only whole-query matches, so a title that merely contains a language name still gets searched.
 */
export function languageFromQuery(query: string): string | undefined {
  const t = query
    .trim()
    .toLowerCase()
    .replace(/\s+(movies?|films?|cinema)$/, "");
  return SEARCH_LANGUAGES.find((l) => l.label.toLowerCase() === t)?.code ?? ALIASES[t];
}

/**
 * Common TMDB original languages beyond the chips. Not every JS engine ships Intl.DisplayNames
 * (React Native's Hermes may not), and raw codes like "zh" read badly.
 */
const MORE_LABELS: Record<string, string> = {
  gu: "Gujarati",
  or: "Odia",
  as: "Assamese",
  ur: "Urdu",
  si: "Sinhala",
  ne: "Nepali",
  zh: "Chinese",
  cn: "Cantonese", // TMDB's code for Cantonese
  th: "Thai",
  id: "Indonesian",
  tl: "Tagalog",
  vi: "Vietnamese",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  tr: "Turkish",
  ar: "Arabic",
  fa: "Persian",
  he: "Hebrew",
  pl: "Polish",
  nl: "Dutch",
  sv: "Swedish",
  da: "Danish",
  no: "Norwegian",
  fi: "Finnish",
};

export function languageLabel(code: string) {
  const known = SEARCH_LANGUAGES.find((l) => l.code === code)?.label ?? MORE_LABELS[code];
  if (known) return known;
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Indian-language originals are often released or streamed with dubbed audio too. */
export const INDIAN_LANGUAGES = new Set(["hi", "ta", "te", "ml", "kn", "bn", "mr", "pa", "gu", "or", "as"]);

/**
 * Splits search matches into films made in `lang` and everything else (kept, not hidden:
 * a Kannada original like KGF may well have a Hindi dub that TMDB doesn't record).
 * Order within each group is preserved (TMDB relevance).
 */
export function splitByLanguage<T extends { original_language?: string }>(movies: T[], lang?: string) {
  if (!lang) return { primary: movies, others: [] as T[] };
  return {
    primary: movies.filter((m) => m.original_language === lang),
    others: movies.filter((m) => m.original_language !== lang),
  };
}
