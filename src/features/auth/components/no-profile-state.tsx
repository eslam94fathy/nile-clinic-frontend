import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/states/empty-state";

export function NoProfileState() {
  const t = useTranslations("auth.noProfile");

  return <EmptyState title={t("heading")} description={t("description")} />;
}
