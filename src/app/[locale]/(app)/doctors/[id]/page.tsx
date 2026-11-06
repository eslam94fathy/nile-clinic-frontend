import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { FilterBar } from "@/components/shared/filter-bar";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { Can } from "@/features/app-shell/public";
import {
  ApiFailureState,
  getCurrentUser,
  ScreenGate,
} from "@/features/auth/public-server";
import { readDoctor } from "@/features/doctors/api/doctors-server";
import { DoctorProfile } from "@/features/doctors/components/doctor-profile";
import { ReadinessSummary } from "@/features/doctors/components/readiness-summary";
import { readinessOf } from "@/features/doctors/readiness";
import { readFee } from "@/features/fees/api/fees-server";
import { FeeDetails } from "@/features/fees/components/fee-details";
import { FeeForm } from "@/features/fees/components/fee-form";
import {
  readSchedule,
  readSlots,
  readTimeOff,
} from "@/features/scheduling/api/scheduling-server";
import { TimeOffForm } from "@/features/scheduling/components/time-off-form";
import { TimeOffList } from "@/features/scheduling/components/time-off-list";
import { UpcomingSlots } from "@/features/scheduling/components/upcoming-slots";
import { WeeklyHours } from "@/features/scheduling/components/weekly-hours";
import { hasPeriods } from "@/features/scheduling/has-periods";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { firstParam } from "@/lib/api/read-resource";
import { can } from "@/lib/auth/permissions";
import { getEnv } from "@/lib/config/env";
import { addDays, clinicToday } from "@/lib/format/clinic-today";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type Params = Promise<{ locale: string; id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SLOT_DAYS_AFTER_TODAY = 30;
const TIME_OFF_DAYS_AFTER_START = 366;

function Section({
  heading,
  id,
  children,
}: {
  heading: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col items-start gap-3">
      <h2 className="text-xl font-semibold">{heading}</h2>
      <Suspense fallback={<LoadingState />}>{children}</Suspense>
    </section>
  );
}

function slotRange(today: string) {
  return [today, addDays(today, SLOT_DAYS_AFTER_TODAY)] as const;
}

async function Readiness({
  locale,
  id,
  active,
  today,
}: {
  locale: string;
  id: number;
  active: boolean;
  today: string;
}) {
  const [from, to] = slotRange(today);
  const [schedule, slots, fee] = await Promise.all([
    readSchedule(locale, id),
    readSlots(locale, id, from, to),
    readFee(locale, id),
  ]);

  return (
    <ReadinessSummary
      doctorId={id}
      readiness={readinessOf({
        active,
        hasPeriods: schedule.ok ? hasPeriods(schedule.data.data) : "unknown",
        slotCount: slots.ok ? slots.data.data.length : "unknown",
        hasFee: fee.ok ? fee.data.data.amount !== null : "unknown",
      })}
    />
  );
}

async function Hours({ locale, id }: { locale: string; id: number }) {
  const t = await getTranslations({ locale, namespace: "scheduling" });
  const schedule = await readSchedule(locale, id);
  if (!schedule.ok) return <ApiFailureState error={schedule.error} />;

  const label = hasPeriods(schedule.data.data)
    ? t("changeHours")
    : t("setHours");
  return (
    <WeeklyHours
      schedule={schedule.data.data}
      emptyTitle={t("noHoursTitle")}
      emptyDescription={t("noHoursDescription")}
      action={
        <Can capability="manageSchedules">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/doctors/${id}/schedule`} prefetch={false}>
              {label}
            </Link>
          </Button>
        </Can>
      }
    />
  );
}

async function Slots({
  locale,
  id,
  today,
}: {
  locale: string;
  id: number;
  today: string;
}) {
  const [from, to] = slotRange(today);
  const slots = await readSlots(locale, id, from, to);
  if (!slots.ok) return <ApiFailureState error={slots.error} />;

  return <UpcomingSlots slots={slots.data.data} />;
}

async function Fee({
  locale,
  id,
  timeZone,
}: {
  locale: string;
  id: number;
  timeZone: string;
}) {
  const fee = await readFee(locale, id);
  if (!fee.ok) return <ApiFailureState error={fee.error} />;

  const { data } = fee.data;
  return (
    <div className="flex w-full flex-col gap-4">
      <FeeDetails fee={data} timeZone={timeZone} />
      <Can capability="setFees">
        <ScopedMessages locale={locale} namespaces={["fees"]}>
          <FeeForm
            key={data.set_at ?? "none"}
            doctorId={id}
            hasFee={data.amount !== null}
          />
        </ScopedMessages>
      </Can>
    </div>
  );
}

async function TimeOffSection({
  locale,
  id,
  today,
  searchParams,
}: {
  locale: string;
  id: number;
  today: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations({ locale, namespace: "scheduling" });
  const query = await searchParams;
  const from = firstParam(query.from) ?? today;
  const to =
    firstParam(query.to) ??
    (/^\d{4}-\d{2}-\d{2}$/.test(from)
      ? addDays(from, TIME_OFF_DAYS_AFTER_START)
      : from);

  const [entries, current] = await Promise.all([
    readTimeOff(locale, id, from, to),
    getCurrentUser(locale),
  ]);
  const canManage =
    current.kind === "signed-in" && can(current.user.role, "manageSchedules");

  return (
    <div className="flex w-full flex-col gap-4">
      <FilterBar
        filters={[
          {
            name: "from",
            label: t("rangeFrom"),
            type: "date",
            inAddress: true,
            hint: t("rangeHint"),
          },
          { name: "to", label: t("rangeTo"), type: "date", inAddress: true },
        ]}
      />
      {entries.ok ? (
        <ScopedMessages locale={locale} namespaces={["scheduling"]}>
          <TimeOffList
            entries={entries.data.data}
            today={today}
            {...(canManage ? { removableBy: id } : {})}
          />
        </ScopedMessages>
      ) : (
        <ApiFailureState error={entries.error} />
      )}
      {canManage ? (
        <ScopedMessages locale={locale} namespaces={["scheduling"]}>
          <div className="flex flex-col gap-3">
            <h3 className="font-medium">{t("addHeading")}</h3>
            <TimeOffForm doctorId={id} />
          </div>
        </ScopedMessages>
      ) : null}
    </div>
  );
}

async function DoctorPageContent({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale, id: rawId } = await params;
  const id = readPositiveId(rawId);
  if (id === null) notFound();

  const doctor = await readDoctor(locale, id);
  if (!doctor.ok) return <ApiFailureState error={doctor.error} />;

  const [doctorText, scheduling, fees] = await Promise.all([
    getTranslations({ locale, namespace: "doctors" }),
    getTranslations({ locale, namespace: "scheduling" }),
    getTranslations({ locale, namespace: "fees" }),
  ]);
  const timeZone = getEnv().CLINIC_TIMEZONE;
  const today = clinicToday(timeZone);

  return (
    <>
      <PageHeader
        title={<UserText>{doctor.data.data.name}</UserText>}
        actions={
          <Button variant="outline" asChild>
            <Link href="/doctors" prefetch={false}>
              {doctorText("backToList")}
            </Link>
          </Button>
        }
      />
      <Can capability="manageDoctors">
        <Suspense fallback={<LoadingState />}>
          <Readiness
            locale={locale}
            id={id}
            active={doctor.data.data.is_active}
            today={today}
          />
        </Suspense>
      </Can>
      <DoctorProfile doctor={doctor.data.data} />
      <Section heading={scheduling("hoursHeading")}>
        <Hours locale={locale} id={id} />
      </Section>
      <Section heading={scheduling("slotsHeading")}>
        <Slots locale={locale} id={id} today={today} />
      </Section>
      <Section heading={fees("sectionHeading")} id="doctor-fee">
        <Fee locale={locale} id={id} timeZone={timeZone} />
      </Section>
      <Section heading={scheduling("timeOffHeading")}>
        <TimeOffSection
          locale={locale}
          id={id}
          today={today}
          searchParams={searchParams}
        />
      </Section>
    </>
  );
}

export default async function DoctorPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="doctors">
        <DoctorPageContent params={params} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
