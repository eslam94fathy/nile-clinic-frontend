import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ErrorState } from "@/components/shared/states/error-state";
import { ForbiddenState } from "@/components/shared/states/forbidden-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { NotFoundState } from "@/components/shared/states/not-found-state";
import { Button } from "@/components/ui/button";
import { PreviewSection } from "./preview-section";

export async function StatesSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "preview.states" });

  return (
    <PreviewSection heading={t("heading")}>
      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
        <LoadingState />
        <ErrorState
          message={t("errorMessage")}
          action={
            <Button type="button" variant="outline">
              {t("reset")}
            </Button>
          }
        />
        <EmptyState
          title={t("emptyNothingYet")}
          description={t("emptyNothingYetDescription")}
          action={<Button type="button">{t("action")}</Button>}
        />
        <EmptyState
          title={t("emptyNoMatches")}
          description={t("emptyNoMatchesDescription")}
          action={
            <Button type="button" variant="outline">
              {t("reset")}
            </Button>
          }
        />
        <ForbiddenState />
        <NotFoundState />
      </div>
    </PreviewSection>
  );
}
