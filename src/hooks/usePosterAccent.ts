import { useQuery } from "@tanstack/react-query";
import { extractAccent, FALLBACK_ACCENT } from "@/lib/color";
import { tmdbImage } from "@/lib/tmdb";

/** Accent colour for a poster path. Always sampled from the small w185 image, cached forever. */
export function usePosterAccent(posterPath?: string | null) {
  const src = tmdbImage(posterPath, "w185");
  const { data } = useQuery({
    queryKey: ["accent", src],
    queryFn: () => extractAccent(src!),
    enabled: !!src,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data ?? FALLBACK_ACCENT;
}
