"use client";

import { Button } from "@/components/ui/button";

/** A full reload, as the failure could be anywhere in the signed-in frame. */
export function RetryButton({ label }: { label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.location.reload()}
    >
      {label}
    </Button>
  );
}
