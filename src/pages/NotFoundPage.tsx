import { Link } from "react-router";
import { useDocumentTitle } from "@/hooks/useUtils";

export default function NotFoundPage({
  title = "Page not found",
  note = "This page isn't playing anywhere. Let's find you something that is.",
}: {
  title?: string;
  note?: string;
}) {
  useDocumentTitle(title);
  return (
    <div className="px-4 pt-[max(env(safe-area-inset-top),1.25rem)] md:px-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
      <div className="mt-6 rounded-[28px] bg-card p-8 ring-1 ring-tint/5">
        <p className="text-muted">{note}</p>
        <Link
          to="/"
          className="mt-5 inline-flex rounded-full bg-tint/10 px-5 py-2.5 text-sm font-semibold hover:bg-tint/15"
        >
          Back to Tonight
        </Link>
      </div>
    </div>
  );
}
