import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states/empty-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { Button } from "@/components/ui/button";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readSpecialties } from "@/features/doctors/api/specialties-server";
import { AccountChooser } from "@/features/doctors/components/account-chooser";
import { DoctorForm } from "@/features/doctors/components/doctor-form";
import {
  readStaffList,
  readStaffMember,
} from "@/features/staff/api/staff-server";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { firstParam } from "@/lib/api/read-resource";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ChooseAccount({
  locale,
  page,
}: {
  locale: string;
  page: string | undefined;
}) {
  const result = await readStaffList(locale, {
    role: "doctor",
    is_active: "1",
    per_page: 50,
    page,
  });
  if (!result.ok) return <ApiFailureState error={result.error} />;

  return <AccountChooser rows={result.data.data} meta={result.data.meta} />;
}

async function CreateProfile({
  locale,
  accountId,
}: {
  locale: string;
  accountId: number;
}) {
  const t = await getTranslations({ locale, namespace: "doctors" });
  const [account, specialties] = await Promise.all([
    readStaffMember(locale, accountId),
    readSpecialties(locale, true),
  ]);
  if (!account.ok) return <ApiFailureState error={account.error} />;
  if (!specialties.ok) return <ApiFailureState error={specialties.error} />;

  if (specialties.data.data.length === 0) {
    return (
      <EmptyState
        title={t("noSpecialtiesTitle")}
        description={t("noSpecialtiesDescription")}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/specialties" prefetch={false}>
              {t("goToSpecialties")}
            </Link>
          </Button>
        }
      />
    );
  }

  const { id, name, email } = account.data.data;
  return (
    <ScopedMessages locale={locale} namespaces={["doctors"]}>
      <DoctorForm
        account={{ id, name, email }}
        specialties={specialties.data.data}
      />
    </ScopedMessages>
  );
}

async function NewDoctor({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const query = await searchParams;
  const rawAccount = firstParam(query.account);
  const accountId =
    rawAccount === undefined ? null : readPositiveId(rawAccount);
  if (rawAccount !== undefined && accountId === null) notFound();

  const t = await getTranslations({ locale, namespace: "doctors" });

  return (
    <>
      <PageHeader
        title={t("chooseTitle")}
        {...(accountId === null ? { description: t("chooseDescription") } : {})}
        actions={
          <Button variant="outline" asChild>
            <Link href="/doctors" prefetch={false}>
              {t("backToList")}
            </Link>
          </Button>
        }
      />
      {accountId === null ? (
        <ChooseAccount locale={locale} page={firstParam(query.page)} />
      ) : (
        <CreateProfile locale={locale} accountId={accountId} />
      )}
    </>
  );
}

export default async function NewDoctorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="doctors" capability="manageDoctors">
        <NewDoctor locale={locale} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
