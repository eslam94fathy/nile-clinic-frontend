import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ScreenGate } from "@/features/auth/public-server";
import { LiveQueryProvider } from "@/features/queue/components/live-query-provider";
import { OwnQueue } from "@/features/queue/components/own-queue";
import { getEnv } from "@/lib/config/env";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

async function MyQueue({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "queue.own" });

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <ScopedMessages locale={locale} namespaces={["queue", "auth"]}>
        <LiveQueryProvider>
          <OwnQueue timeZone={getEnv().CLINIC_TIMEZONE} />
        </LiveQueryProvider>
      </ScopedMessages>
    </>
  );
}

export default async function MyQueuePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="my/queue">
        <MyQueue locale={locale} />
      </ScreenGate>
    </Suspense>
  );
}
