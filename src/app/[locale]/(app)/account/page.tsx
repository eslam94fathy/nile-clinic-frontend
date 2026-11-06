import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { PasswordForm } from "@/features/auth/components/password-form";
import { getCurrentUser, ScreenGate } from "@/features/auth/public-server";

async function Account({ locale }: { locale: string }) {
  const current = await getCurrentUser(locale);
  // The gate has already handled these, and shares this answer.
  if (current.kind !== "signed-in") return null;

  const { user } = current;
  const t = await getTranslations({ locale });
  const a = await getTranslations({ locale, namespace: "auth.account" });

  return (
    <>
      <PageHeader title={a("title")} description={a("description")} />
      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">{a("name")}</dt>
        <dd className="break-words">
          <UserText>{user.name}</UserText>
        </dd>
        <dt className="text-muted-foreground">{a("email")}</dt>
        <dd className="break-all">
          <LtrText>{user.email}</LtrText>
        </dd>
        <dt className="text-muted-foreground">{a("role")}</dt>
        <dd>{t(`roles.${user.role}`)}</dd>
      </dl>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{a("passwordHeading")}</h2>
        <PasswordForm
          text={{
            currentPassword: a("currentPassword"),
            newPassword: a("newPassword"),
            confirmPassword: a("confirmPassword"),
            passwordHint: a("passwordHint"),
            submit: a("submit"),
            working: a("working"),
            success: a("success"),
            currentRequired: a("currentRequired"),
            lengthRule: a("lengthRule"),
            mismatch: a("mismatch"),
            generalFailure: t("auth.errors.general"),
          }}
        />
      </section>
    </>
  );
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="account">
        <Account locale={locale} />
      </ScreenGate>
    </Suspense>
  );
}
