import { createFileRoute } from "@tanstack/react-router";
import { IsoGrid } from "@/components/IsoGrid";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-foreground">Isometric 8×8 Grid</h1>
        <p className="text-muted-foreground mt-2">Click any tile to paint it.</p>
      </div>
      <IsoGrid />
    </div>
  );
}
