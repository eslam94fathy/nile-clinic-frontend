import { LoadingState } from "@/components/shared/states/loading-state";

/** The static shell's stand-in. It holds nothing personal (ADR 0006). */
export function ShellSkeleton() {
  return (
    <main className="p-4">
      <LoadingState />
    </main>
  );
}
