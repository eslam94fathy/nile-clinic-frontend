import { useTranslations } from "next-intl";

export function NoValue() {
  const t = useTranslations("shared");

  return (
    <span>
      <span aria-hidden="true">{"—"}</span>
      <span className="sr-only">{t("noValue")}</span>
    </span>
  );
}
