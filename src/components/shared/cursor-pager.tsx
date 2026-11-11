"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export type CursorMove = "newer" | "older";

/**
 * Paging for a list with no total, such as the audit trail, whose API gives only the next and previous positions.
 * It shows no total, page count, or page number, as there are none. Each press is the caller's to make exactly
 * once, so both buttons are disabled while one is in progress.
 */
export function CursorPager({
  hasNewer,
  hasOlder,
  onNewer,
  onOlder,
  busy,
  atNewest,
}: {
  hasNewer: boolean;
  hasOlder: boolean;
  onNewer: () => void;
  onOlder: () => void;
  busy: CursorMove | null;
  atNewest: boolean;
}) {
  const t = useTranslations("shared.cursorPager");

  return (
    <nav
      aria-label={t("label")}
      className="flex flex-wrap items-center justify-between gap-2 py-3 text-[0.8125rem] text-muted-foreground"
    >
      <p>{atNewest ? t("newest") : null}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasNewer || busy !== null}
          aria-busy={busy === "newer" || undefined}
          onClick={onNewer}
        >
          <ChevronLeftIcon className="rtl:rotate-180" />
          {busy === "newer" ? t("moving") : t("newer")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasOlder || busy !== null}
          aria-busy={busy === "older" || undefined}
          onClick={onOlder}
        >
          {busy === "older" ? t("moving") : t("older")}
          <ChevronRightIcon className="rtl:rotate-180" />
        </Button>
      </div>
    </nav>
  );
}
