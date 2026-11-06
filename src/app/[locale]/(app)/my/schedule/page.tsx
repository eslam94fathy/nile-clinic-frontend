import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import {
  readSchedule,
  readSlots,
  readTimeOff,
} from "@/features/scheduling/api/scheduling-server";
import { TimeOffList } from "@/features/scheduling/components/time-off-list";
import { UpcomingSlots } from "@/features/scheduling/components/upcoming-slots";
import { WeeklyHours } from "@/features/scheduling/components/weekly-hours";
import { getEnv } from "@/lib/config/env";
import { addDays, clinicToday } from "@/lib/format/clinic-today";

async function MySchedule({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "scheduling" });
  const today = clinicToday(getEnv().CLINIC_TIMEZONE);
  const [schedule, slots, timeOff] = await Promise.all([
    readSchedule(locale, "me"),
    readSlots(locale, "me", today, addDays(today, 30)),
    readTimeOff(locale, "me", today, addDays(today, 366)),
  ]);

  return (
    <>
      <PageHeader title={t("myTitle")} description={t("myDescription")} />
      <section className="flex flex-col items-start gap-3">
        <h2 className="text-xl font-semibold">{t("hoursHeading")}</h2>
        {schedule.ok ? (
          <WeeklyHours
            schedule={schedule.data.data}
            emptyTitle={t("ownNoHoursTitle")}
            emptyDescription={t("ownNoHoursDescription")}
          />
        ) : (
          <ApiFailureState error={schedule.error} />
        )}
      </section>
      <section className="flex flex-col items-start gap-3">
        <h2 className="text-xl font-semibold">{t("slotsHeading")}</h2>
        {slots.ok ? (
          <UpcomingSlots slots={slots.data.data} />
        ) : (
          <ApiFailureState error={slots.error} />
        )}
      </section>
      <section className="flex w-full flex-col gap-3">
        <h2 className="text-xl font-semibold">{t("timeOffHeading")}</h2>
        {timeOff.ok ? (
          <TimeOffList entries={timeOff.data.data} today={today} />
        ) : (
          <ApiFailureState error={timeOff.error} />
        )}
      </section>
    </>
  );
}

export default async function MySchedulePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="my/schedule">
        <MySchedule locale={locale} />
      </ScreenGate>
    </Suspense>
  );
}
