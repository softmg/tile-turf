import { createFileRoute } from "@tanstack/react-router";
import { IsoGrid } from "@/components/IsoGrid";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="tt-page min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-[40px] font-bold text-[var(--tt-text-primary)]">Tile Turf</h1>
        <p className="mt-2 text-[22px] font-medium text-[var(--tt-text-secondary)]">
          Move across tiles, paint turf, and bank points with chests.
        </p>
      </div>
      <IsoGrid />
    </div>
  );
}
