/**
 * The "mood search" engine: mood → TMDB genre rules.
 * Platform-free: icons and colours are added by each app (web: lucide + CSS vars, mobile: lucide-react-native + tokens).
 */
export type MoodId = "cozy" | "mind" | "feel" | "edge";

export interface Mood {
  id: MoodId;
  label: string;
  tagline: string;
  /** TMDB genre ids — matched with OR */
  genres: number[];
  /** genres that would break the vibe */
  exclude: number[];
  minRating: number;
  minVotes: number;
  sort: string;
}

// TMDB movie genre ids
export const GENRES: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export const MOODS: Record<MoodId, Mood> = {
  cozy: {
    id: "cozy",
    label: "Cozy",
    tagline: "Blanket on, stakes low, heart warm.",
    genres: [35, 10749, 10751, 16],
    exclude: [27, 53, 80, 10752, 28], // action breaks "stakes low" (e.g. gory anime tagged Animation)
    minRating: 6.6,
    minVotes: 400,
    sort: "popularity.desc",
  },
  mind: {
    id: "mind",
    label: "Mind-bending",
    tagline: "You'll be thinking about it in the shower tomorrow.",
    genres: [878, 9648],
    exclude: [10751, 16, 10749],
    minRating: 7,
    minVotes: 1500,
    sort: "vote_average.desc",
  },
  feel: {
    id: "feel",
    label: "Feel-good",
    tagline: "Guaranteed to leave you smiling.",
    genres: [35, 10402, 12, 10751],
    exclude: [27, 53, 80, 10752],
    minRating: 7,
    minVotes: 800,
    sort: "popularity.desc",
  },
  edge: {
    id: "edge",
    label: "Edge of seat",
    tagline: "Don't plan on blinking.",
    genres: [53, 28, 80],
    exclude: [16, 10751, 35],
    minRating: 6.8,
    minVotes: 800,
    sort: "popularity.desc",
  },
};

export const MOOD_ORDER: MoodId[] = ["cozy", "mind", "feel", "edge"];
