import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { PosterCard } from "@/components/home/PosterCard";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLanguageBrowse, useSearch, useTrending } from "@/hooks/useTmdb";
import { useDebounced, useDocumentTitle } from "@/hooks/useUtils";
import { SEARCH_LANGUAGES, languageFromQuery, languageLabel } from "@/lib/languages";
import type { MovieSummary } from "@/lib/tmdb";

/**
 * Results for the search field in the navbar (?q=…), optionally limited to an original
 * language (?lang=hi). Language with no text = browse that language.
 */
export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = useDebounced(params.get("q") ?? "", 300);
  const lang = params.get("lang") || undefined;
  const label = lang ? languageLabel(lang) : undefined;

  // Typed just a language ("tamil", "bollywood movies") → switch to browsing it.
  const typedLanguage = languageFromQuery(q);
  useEffect(() => {
    if (!typedLanguage) return;
    setParams({ lang: typedLanguage }, { replace: true });
  }, [typedLanguage, setParams]);

  const active = q.trim().length >= 2 && !typedLanguage;
  const search = useSearch(active ? q : "", lang);
  const browse = useLanguageBrowse(active ? undefined : lang);
  const trending = useTrending();

  const setLang = (code?: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (code) next.set("lang", code);
        else next.delete("lang");
        return next;
      },
      { replace: true },
    );

  const title = active ? "Results" : label ? `Made in ${label}` : "Search";
  const eyebrow = active
    ? `for “${q.trim()}”${label ? ` · ${label} first` : ""}`
    : label
      ? "Popular in India · ranked for you"
      : "Type in the bar below";
  useDocumentTitle(active ? `“${q.trim()}”` : (label ?? "Search"));

  return (
    <>
      <PageHeader title={title} eyebrow={eyebrow} />
      <div className="space-y-5 px-4 pt-1 md:px-8">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Original language</p>
          <LanguageChips value={lang} onChange={setLang} />
        </div>

        {active ? (
          search.isError ? (
            <ErrorCard error={search.error} onRetry={search.refetch} />
          ) : search.isLoading ? (
            <Grid loading />
          ) : search.primary.length || search.others.length ? (
            <div className={`space-y-8 transition-opacity ${search.isPlaceholderData ? "opacity-60" : ""}`}>
              {search.primary.length > 0 && (
                <div className="space-y-3">
                  {label && <SectionTitle title={`Made in ${label}`} />}
                  <Grid movies={search.primary} section="search" showLanguage={!label} />
                </div>
              )}
              {search.others.length > 0 && (
                <div className="space-y-3">
                  <SectionTitle
                    title="From other languages · often dubbed"
                    note={
                      search.primary.length
                        ? `Our data only knows each film's original language, so ${label} dubs aren't listed. Check the audio options in the streaming app.`
                        : `No ${label} originals matched “${q.trim()}”. These were made in other languages and may have ${label} dubs; check the audio options in the streaming app.`
                    }
                  />
                  <Grid movies={search.others} section="search-other" showLanguage />
                </div>
              )}
            </div>
          ) : (
            <Empty text={`Nothing matched “${q.trim()}”. Try a different spelling or a shorter title.`} />
          )
        ) : lang ? (
          browse.isError ? (
            <ErrorCard error={browse.error} onRetry={browse.refetch} />
          ) : browse.isLoading ? (
            <Grid loading />
          ) : browse.recs.length ? (
            <Grid movies={browse.recs.map((r) => r.movie)} section={`lang-${lang}`} />
          ) : (
            <Empty text={`Nothing in ${label} is streaming or rentable in India right now.`} />
          )
        ) : (
          <>
            <h2 className="font-display text-xl font-bold">Trending now</h2>
            <Grid movies={trending.data?.slice(0, 18)} section="search-trending" loading={trending.isLoading} />
          </>
        )}
      </div>
    </>
  );
}

function LanguageChips({ value, onChange }: { value?: string; onChange: (code?: string) => void }) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-ink text-inverse" : "bg-card text-ink ring-1 ring-tint/5 hover:bg-card-2"
    }`;
  return (
    <div role="group" aria-label="Language" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
      <button aria-pressed={!value} onClick={() => onChange(undefined)} className={chip(!value)}>
        Any language
      </button>
      {SEARCH_LANGUAGES.map((l) => (
        <button key={l.code} aria-pressed={value === l.code} onClick={() => onChange(l.code)} className={chip(value === l.code)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {note && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

function Empty({ text, action }: { text: string; action?: { text: string; onClick: () => void } }) {
  return (
    <div className="rounded-[28px] bg-card p-8 text-center ring-1 ring-tint/5">
      <p className="text-sm text-muted">{text}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-full bg-tint/10 px-4 py-2 text-sm font-semibold hover:bg-tint/15"
        >
          {action.text}
        </button>
      )}
    </div>
  );
}

function Grid({
  movies,
  section = "grid",
  loading,
  dim,
  showLanguage,
}: {
  movies?: MovieSummary[];
  section?: string;
  loading?: boolean;
  dim?: boolean;
  showLanguage?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-3 gap-3 transition-opacity sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 ${dim ? "opacity-60" : ""}`}
    >
      {loading
        ? Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-[2/3] w-full" />)
        : movies?.map((m) => <PosterCard key={m.id} movie={m} section={section} fluid showLanguage={showLanguage} />)}
    </div>
  );
}
