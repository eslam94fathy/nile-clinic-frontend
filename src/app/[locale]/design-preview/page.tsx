import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoadingState } from "@/components/shared/states/loading-state";
import { PreviewPage } from "@/features/design-preview/components/preview-page";
import { getEnv } from "@/lib/config/env";

// The second of two gates. `src/proxy.ts` gives the 404, which can't come from here once streaming has
// started. This one reads the setting at request time, inside Suspense, so that no prerendered file
// ever holds the preview's content (ADR 0007).
async function Gate({ locale }: { locale: string }) {
  await connection();
  const env = getEnv();
  if (env.DESIGN_PREVIEW_ENABLED !== "true") notFound();

  return <PreviewPage locale={locale} timeZone={env.CLINIC_TIMEZONE} />;
}

export default async function DesignPreviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <Gate locale={locale} />
    </Suspense>
  );
}
