"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { endSession } from "@/lib/auth/session-end";
import { isSessionAlive } from "../api/encounters";

/**
 * Nobody chose this, and what's typed exists only on screen, so leaving waits for the person (ADR 0014). Another tab
 * may have signed in again by then, sharing the same cookie, so this checks first. Otherwise it would end a healthy
 * session, send other tabs to sign-in, and lose the text for nothing.
 */
export function SessionEndedNotice({
  onSignedInAgain,
}: {
  onSignedInAgain: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("encounters.sessionEnded");
  const [checking, setChecking] = useState(false);

  async function signIn() {
    if (checking) return;
    setChecking(true);
    const alive = await isSessionAlive(locale);
    setChecking(false);
    if (alive) onSignedInAgain();
    else endSession();
  }

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-lg border border-destructive p-4"
    >
      <p className="font-semibold">{t("heading")}</p>
      <p>{t("description")}</p>
      <Button
        type="button"
        aria-disabled={checking}
        className="aria-disabled:opacity-70"
        onClick={() => void signIn()}
      >
        {t("signIn")}
      </Button>
    </div>
  );
}
