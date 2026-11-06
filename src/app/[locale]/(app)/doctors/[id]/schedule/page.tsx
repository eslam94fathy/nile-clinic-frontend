import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readDoctor } from "@/features/doctors/api/doctors-server";
import { readSchedule } from "@/features/scheduling/api/scheduling-server";
import { ScheduleEditor } from "@/features/scheduling/components/schedule-editor";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type Params = Promise<{ locale: string; id: string }>;

async function EditSchedule({ params }: { params: Params }) {
  const { locale, id: rawId } = await params;
  const id = readPositiveId(rawId);
  if (id === null) notFound();

  const [t, doctorText] = await Promise.all([
    getTranslations({ locale, namespace: "scheduling" }),
    getTranslations({ locale, namespace: "doctors" }),
  ]);
  const [doctor, schedule] = await Promise.all([
    readDoctor(locale, id),
    readSchedule(locale, id),
  ]);
  if (!doctor.ok) return <ApiFailureState error={doctor.error} />;
  if (!schedule.ok) return <ApiFailureState error={schedule.error} />;

  return (
    <>
      <PageHeader
        title={
          <>
            {t("editorTitle")}
            {": "}
            <UserText>{doctor.data.data.name}</UserText>
          </>
        }
        description={t("editorDescription")}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/doctors/${id}`} prefetch={false}>
              {doctorText("backToDoctor")}
            </Link>
          </Button>
        }
      />
      <ScopedMessages locale={locale} namespaces={["scheduling", "days"]}>
        <ScheduleEditor
          key={schedule.data.data.updated_at ?? "none"}
          doctorId={id}
          schedule={schedule.data.data}
        />
      </ScopedMessages>
    </>
  );
}

export default async function SchedulePage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="doctors" capability="manageSchedules">
        <EditSchedule params={params} />
      </ScreenGate>
    </Suspense>
  );
}
