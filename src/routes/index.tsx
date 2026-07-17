import { createFileRoute } from "@tanstack/react-router";
import { IsoGrid } from "@/components/IsoGrid";
import { useMessages } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const messages = useMessages();
  return (
    <div className="tt-page min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-[40px] font-bold text-[var(--tt-text-primary)]">{messages.appTitle}</h1>
        <p className="mt-2 text-[22px] font-medium text-[var(--tt-text-secondary)]">
          {messages.appDescription}
        </p>
      </div>
      <IsoGrid />
    </div>
  );
}
