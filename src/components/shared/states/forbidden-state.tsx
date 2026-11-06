import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export function ForbiddenState({ action }: { action?: ReactNode }) {
  const t = useTranslations("shared.states");

  return (
    <div role="alert" className="flex flex-col items-start gap-2 py-4">
      <p className="font-medium">{t("forbiddenHeading")}</p>
      <p className="text-muted-foreground">{t("forbiddenDescription")}</p>
      {action}
    </div>
  );
}
