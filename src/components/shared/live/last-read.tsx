"use client";

import { useTranslations } from "next-intl";
import { Instant } from "@/components/shared/values/instant";
import { Button } from "@/components/ui/button";

/**
 * When the list on screen was read, and whether it may be out of date. Only the notice is announced, once, as it
 * changes: reading a list aloud every 15 seconds would make a screen reader unusable (FR-019). The button is
 * never disabled, as a refresh on the timer would otherwise take the focus off it.
 */
export function LastRead({
  readAt,
  outOfDate,
  reading,
  onRefresh,
  timeZone,
}: {
  readAt: number;
  outOfDate: boolean;
  reading: boolean;
  onRefresh: () => void;
  timeZone: string;
}) {
  const t = useTranslations("queue.lastRead");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-[0.8125rem] text-muted-foreground">
        {readAt > 0 ? (
          <p>
            {t("label")}{" "}
            <Instant
              value={new Date(readAt).toISOString()}
              timeZone={timeZone}
            />
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (!reading) onRefresh();
          }}
        >
          {t("refresh")}
        </Button>
      </div>
      {/* Always present, so that a change to its text is what gets announced. */}
      <p
        role="status"
        className={
          outOfDate
            ? "rounded-lg border border-status-warning-border bg-status-warning p-3 font-medium text-status-warning-foreground"
            : "sr-only"
        }
      >
        {outOfDate ? t("outOfDate") : ""}
      </p>
    </div>
  );
}
