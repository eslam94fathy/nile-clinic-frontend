import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ClinicTime } from "@/components/shared/values/clinic-time";
import { hasPeriods } from "../has-periods";
import type { Schedule } from "../types";

/** Read-only, for the doctor's page and for a doctor's own schedule. */
export function WeeklyHours({
  schedule,
  emptyTitle,
  emptyDescription,
  action,
}: {
  schedule: Schedule;
  emptyTitle: string;
  emptyDescription: string;
  action?: ReactNode;
}) {
  const t = useTranslations("scheduling");
  const dayNames = useTranslations("days");

  if (!hasPeriods(schedule)) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={action}
      />
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {schedule.appointment_minutes === null ? null : (
        <p>
          {t("appointmentLength", { minutes: schedule.appointment_minutes })}
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {schedule.days.map(({ day, periods }) => (
          <div key={day} className="contents">
            <dt className="text-muted-foreground">{dayNames(day)}</dt>
            <dd className="flex flex-wrap gap-x-3">
              {periods.length === 0
                ? t("dayOff")
                : periods.map(({ start, end }) => (
                    <span key={start}>
                      <ClinicTime value={start} />
                      {" – "}
                      <ClinicTime value={end} />
                    </span>
                  ))}
            </dd>
          </div>
        ))}
      </dl>
      {action}
    </div>
  );
}
