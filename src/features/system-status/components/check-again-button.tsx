"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLayoutEffect, useRef, useTransition } from "react";
import { SYSTEM_STATUS_REGION_ID } from "../types";

export function CheckAgainButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const button = useRef<HTMLButtonElement>(null);

  // When a successful check removes this button, keep keyboard users' place on the page.
  useLayoutEffect(() => {
    const current = button.current;
    return () => {
      if (current && document.activeElement === current) {
        document.getElementById(SYSTEM_STATUS_REGION_ID)?.focus();
      }
    };
  }, []);

  return (
    <Button
      ref={button}
      variant="outline"
      type="button"
      // Not `disabled`, which would drop keyboard focus from the button.
      aria-disabled={isPending}
      onClick={() => {
        if (!isPending) startTransition(() => router.refresh());
      }}
      className="aria-disabled:opacity-70"
    >
      {isPending ? pendingLabel : label}
    </Button>
  );
}
