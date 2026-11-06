"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { leaveAfterSignOut } from "@/lib/auth/session-end";
import { signOut } from "../api/sign-out";

export function SignOutButton({
  label,
  workingLabel,
  failureLabel,
}: {
  label: string;
  workingLabel: string;
  failureLabel: string;
}) {
  const [working, setWorking] = useState(false);

  async function handleClick() {
    if (working) return;
    setWorking(true);

    if (await signOut()) {
      leaveAfterSignOut();
      return;
    }

    // The cookie can't be cleared, so pretending otherwise would leave a live session on a shared computer.
    setWorking(false);
    toast.error(failureLabel);
  }

  return (
    <Button
      type="button"
      variant="outline"
      aria-disabled={working}
      onClick={handleClick}
      className="aria-disabled:opacity-70"
    >
      {working ? workingLabel : label}
    </Button>
  );
}
