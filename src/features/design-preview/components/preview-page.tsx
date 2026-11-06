import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { LtrText } from "@/components/shared/values/ltr-text";
import { ActionsDemo } from "./actions-demo";
import { FormSection } from "./form-section";
import { PagePartsSection } from "./page-parts-section";
import { PreviewSection } from "./preview-section";
import { StatesSection } from "./states-section";
import { StatusSection } from "./status-section";
import { ValuesSection } from "./values-section";

export async function PreviewPage({
  locale,
  timeZone,
}: {
  locale: string;
  timeZone: string;
}) {
  const t = await getTranslations({ locale, namespace: "preview" });
  const a = await getTranslations({ locale, namespace: "preview.actions" });

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-24">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <span className="text-xs text-muted-foreground">
            <LtrText>{t("sentinel")}</LtrText>
          </span>
        }
      />
      <ValuesSection locale={locale} timeZone={timeZone} />
      <StatusSection locale={locale} />
      <StatesSection locale={locale} />
      <PagePartsSection locale={locale} />
      <FormSection locale={locale} />
      <PreviewSection heading={a("heading")}>
        <ActionsDemo
          text={{
            open: a("open"),
            openFailing: a("openFailing"),
            title: a("title"),
            description: a("description"),
            confirm: a("confirm"),
            failure: a("failure"),
            success: a("success"),
            showSuccess: a("showSuccess"),
            showFailure: a("showFailure"),
            failureNotice: a("failureNotice"),
          }}
        />
      </PreviewSection>
    </main>
  );
}
