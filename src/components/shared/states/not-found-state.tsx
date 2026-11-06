import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** Says nothing about whether a record exists: for medical records, the backend doesn't either. */
export function NotFoundState({ action }: { action?: ReactNode }) {
  const t = useTranslations("shared.states");

  return (
    <div role="status" className="flex flex-col items-start gap-2 py-4">
      <p className="font-medium">{t("notFoundHeading")}</p>
      <p className="text-muted-foreground">{t("notFoundDescription")}</p>
      {action}
    </div>
  );
}
