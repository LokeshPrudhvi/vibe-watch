import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

interface Props {
  title: string;
  subtitle?: string;
  loading?: boolean;
  children: ReactNode;
}

export function PosterRow({ title, subtitle, loading, children }: Props) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {loading
          ? Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-32 shrink-0 sm:w-36 md:w-40" />
            ))
          : children}
      </div>
    </section>
  );
}
