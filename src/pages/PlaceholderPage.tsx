import { PageHeader } from "@/components/layout/PageHeader";
import { useDocumentTitle } from "@/hooks/useUtils";

export default function PlaceholderPage({ title, note }: { title: string; note: string }) {
  useDocumentTitle(title);
  return (
    <>
      <PageHeader title={title} eyebrow="Coming soon" />
      <div className="px-4 pt-2 md:px-8">
        <div className="rounded-[28px] bg-card p-8 text-muted ring-1 ring-tint/5">{note}</div>
      </div>
    </>
  );
}
