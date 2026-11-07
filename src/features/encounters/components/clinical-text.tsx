import { useTranslations } from "next-intl";

/**
 * Clinical text exactly as written: as text and never markup, keeping its line breaks, taking its direction from
 * itself, and asking browsers not to send it for translation (FR-040, research R9, R10).
 */
export function ClinicalText({ value }: { value: string | null | undefined }) {
  const t = useTranslations("encounters.view");

  if (!value) {
    return <p className="text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <p
      dir="auto"
      translate="no"
      className="whitespace-pre-wrap [overflow-wrap:anywhere]"
    >
      {value}
    </p>
  );
}
