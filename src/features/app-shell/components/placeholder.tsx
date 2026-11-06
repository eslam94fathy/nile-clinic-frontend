import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states/empty-state";

/** A navigation entry whose screen belongs to a later phase. It calls no API for feature data. */
export function Placeholder({ labelKey }: { labelKey: string }) {
  const t = useTranslations("shell");

  return (
    <>
      <PageHeader title={t(`nav.${labelKey}`)} />
      <EmptyState
        title={t("placeholderHeading")}
        description={t("placeholderDescription")}
      />
    </>
  );
}
