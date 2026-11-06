import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/features/auth/api/current-user";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { SystemStatus } from "@/features/system-status/components/system-status";
import { SystemStatusChecking } from "@/features/system-status/components/system-status-checking";
import { SYSTEM_STATUS_REGION_ID } from "@/features/system-status/types";

type SearchParams = Promise<{ ended?: string | string[] }>;

async function SessionEndedNotice({
  locale,
  searchParams,
}: {
  locale: string;
  searchParams: SearchParams;
}) {
  const { ended } = await searchParams;
  if (ended !== "1") return null;

  const t = await getTranslations({ locale, namespace: "auth.signIn" });
  return (
    <p role="alert" className="rounded-lg border p-3 font-medium">
      {t("sessionEnded")}
    </p>
  );
}

async function RedirectIfSignedIn({ locale }: { locale: string }) {
  const current = await getCurrentUser(locale);
  if (current.kind === "signed-in") redirect(`/${locale}/dashboard`);
  return null;
}

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t("signIn.heading")}</h1>
        <p className="text-muted-foreground">{t("signIn.description")}</p>
      </div>
      <Suspense fallback={null}>
        <RedirectIfSignedIn locale={locale} />
        <SessionEndedNotice locale={locale} searchParams={searchParams} />
      </Suspense>
      <SignInForm
        text={{
          email: t("signIn.email"),
          password: t("signIn.password"),
          submit: t("signIn.submit"),
          working: t("signIn.working"),
          emailRequired: t("signIn.emailRequired"),
          passwordRequired: t("signIn.passwordRequired"),
          generalFailure: t("errors.general"),
        }}
      />
      <p className="text-sm text-muted-foreground">
        {t("signIn.forgotPassword")}
      </p>
      {/* Stays in place while its content changes, so screen readers announce the result. */}
      <div id={SYSTEM_STATUS_REGION_ID} role="status" tabIndex={-1}>
        <Suspense fallback={<SystemStatusChecking locale={locale} />}>
          <SystemStatus locale={locale} />
        </Suspense>
      </div>
      <noscript>
        <p>{t("signIn.noscript")}</p>
      </noscript>
    </main>
  );
}
