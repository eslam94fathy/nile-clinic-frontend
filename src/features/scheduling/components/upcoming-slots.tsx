import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { ClinicTime } from "@/components/shared/values/clinic-time";
import { formatCount } from "@/lib/format/locale";
import type { Slot } from "../types";

const DATES_SHOWN = 7;

/** A count, and the first dates. A schedule can give hundreds of slots, which booking will use in full. */
export function UpcomingSlots({ slots }: { slots: Slot[] }) {
  const locale = useLocale();
  const t = useTranslations("scheduling");

  if (slots.length === 0) {
    return (
      <EmptyState
        title={t("slotsEmptyTitle")}
        description={t("slotsEmptyDescription")}
      />
    );
  }

  const byDate = new Map<string, Slot[]>();
  for (const slot of slots) {
    byDate.set(slot.date, [...(byDate.get(slot.date) ?? []), slot]);
  }
  const dates = [...byDate.entries()].slice(0, DATES_SHOWN);

  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">
        {t("slotsCount", {
          total: slots.length,
          count: formatCount(slots.length, locale),
        })}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {dates.map(([date, rows]) => (
          <div key={date} className="contents">
            <dt className="text-muted-foreground">
              <ClinicDate value={date} />
            </dt>
            <dd className="flex flex-wrap gap-x-2">
              {rows.map(({ start }) => (
                <ClinicTime key={start} value={start} />
              ))}
            </dd>
          </div>
        ))}
      </dl>
      {byDate.size > DATES_SHOWN ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          {t("slotsFirstDates")}
        </p>
      ) : null}
    </div>
  );
}
