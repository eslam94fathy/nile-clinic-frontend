import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Instant } from "@/components/shared/values/instant";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import {
  ApiFailureState,
  getCurrentUser,
  ScreenGate,
} from "@/features/auth/public-server";
import { readStaffMember } from "@/features/staff/api/staff-server";
import { AccountActions } from "@/features/staff/components/account-actions";
import { StaffEditForm } from "@/features/staff/components/staff-edit-form";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { getEnv } from "@/lib/config/env";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type Params = Promise<{ locale: string; id: string }>;

async function Account({ params }: { params: Params }) {
  const { locale, id: rawId } = await params;
  const id = readPositiveId(rawId);
  if (id === null) notFound();

  const t = await getTranslations({ locale, namespace: "staff" });
  const result = await readStaffMember(locale, id);
  if (!result.ok) return <ApiFailureState error={result.error} />;

  const member = result.data.data;
  const current = await getCurrentUser(locale);
  const isSelf = current.kind === "signed-in" && current.user.id === member.id;
  const timeZone = getEnv().CLINIC_TIMEZONE;

  return (
    <>
      <PageHeader
        title={<UserText>{member.name}</UserText>}
        actions={
          <Button variant="outline" asChild>
            <Link href="/staff" prefetch={false}>
              {t("backToList")}
            </Link>
          </Button>
        }
      />
      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">{t("status")}</dt>
        <dd>
          <StatusBadge
            kind="activity"
            value={member.is_active ? "active" : "deactivated"}
          />
        </dd>
        <dt className="text-muted-foreground">{t("createdAt")}</dt>
        <dd>
          <Instant value={member.created_at} timeZone={timeZone} />
        </dd>
        <dt className="text-muted-foreground">{t("updatedAt")}</dt>
        <dd>
          <Instant value={member.updated_at} timeZone={timeZone} />
        </dd>
      </dl>
      <ScopedMessages locale={locale} namespaces={["staff", "roles"]}>
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{t("detailsHeading")}</h2>
          <StaffEditForm
            key={member.updated_at}
            member={member}
            isSelf={isSelf}
          />
        </section>
        <AccountActions member={member} isSelf={isSelf} />
      </ScopedMessages>
    </>
  );
}

export default async function StaffMemberPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="staff">
        <Account params={params} />
      </ScreenGate>
    </Suspense>
  );
}
