import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState } from "@/components/shared/states/loading-state";
import { NotFoundState } from "@/components/shared/states/not-found-state";
import { Button } from "@/components/ui/button";
import { ApiFailureState, ScreenGate } from "@/features/auth/public-server";
import { readCharge } from "@/features/billing/api/charges-server";
import { ChargeActions } from "@/features/billing/components/charge-actions";
import { ChargeView } from "@/features/billing/components/charge-view";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { getEnv } from "@/lib/config/env";
import { Link } from "@/lib/i18n/navigation";
import { ScopedMessages } from "@/lib/i18n/scoped-messages";

type Params = Promise<{ locale: string; id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ChargePageContent({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale, id: rawId } = await params;
  const t = await getTranslations({ locale, namespace: "charges.details" });
  const back = (
    <Button variant="outline" asChild>
      <Link href="/charges" prefetch={false}>
        {t("back")}
      </Link>
    </Button>
  );

  // Not a number a charge can have, so nothing is read.
  const id = readPositiveId(rawId);
  if (id === null) return <NotFoundState action={back} />;

  const result = await readCharge(locale, id);
  if (!result.ok) {
    return result.error.status === 404 ? (
      <NotFoundState action={back} />
    ) : (
      <ApiFailureState error={result.error} />
    );
  }

  const charge = result.data.data;
  const timeZone = getEnv().CLINIC_TIMEZONE;
  // Set by Billing's "Charge visit", so that the payment form takes focus once. The form removes it.
  const justCharged = (await searchParams).charged === "1";

  return (
    <>
      <PageHeader
        title={t("title", { number: String(charge.id) })}
        actions={back}
      />
      <ScopedMessages locale={locale} namespaces={["charges", "auth"]}>
        <ChargeView
          charge={charge}
          timeZone={timeZone}
          actions={<ChargeActions charge={charge} justCharged={justCharged} />}
        />
      </ScopedMessages>
    </>
  );
}

export default async function ChargePage({
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
      <ScreenGate locale={locale} path="charges">
        <ChargePageContent params={params} searchParams={searchParams} />
      </ScreenGate>
    </Suspense>
  );
}
