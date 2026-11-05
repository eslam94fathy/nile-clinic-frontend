import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { SystemStatus } from "@/features/system-status/components/system-status";
import { SystemStatusChecking } from "@/features/system-status/components/system-status-checking";
import { SYSTEM_STATUS_REGION_ID } from "@/features/system-status/types";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "landing" });

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t("heading")}</h1>
        <p className="text-neutral-700">{t("description")}</p>
      </div>
      {/* Stays in place while its content changes, so screen readers announce the result. */}
      <div id={SYSTEM_STATUS_REGION_ID} role="status" tabIndex={-1}>
        <Suspense fallback={<SystemStatusChecking locale={locale} />}>
          <SystemStatus locale={locale} />
        </Suspense>
      </div>
      <noscript>
        <p>{t("noscript")}</p>
      </noscript>
    </main>
  );
}
