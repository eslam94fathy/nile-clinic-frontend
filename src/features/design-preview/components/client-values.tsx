"use client";

import { ClinicDate } from "@/components/shared/values/clinic-date";
import { ClinicTime } from "@/components/shared/values/clinic-time";
import { Instant } from "@/components/shared/values/instant";
import { Money } from "@/components/shared/values/money";

/** Renders in the browser too, so a test can prove the browser's time zone doesn't matter. */
export function ClientValues({
  label,
  money,
  date,
  time,
  instant,
  timeZone,
}: {
  label: string;
  money: string;
  date: string;
  time: string;
  instant: string;
  timeZone: string;
}) {
  return (
    <section aria-label={label} className="flex flex-wrap gap-x-6 gap-y-2">
      <Money value={money} />
      <ClinicDate value={date} />
      <ClinicTime value={time} />
      <Instant value={instant} timeZone={timeZone} />
    </section>
  );
}
