import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  message,
  onRetry,
  action,
}: {
  /** The backend's translated message, shown as sent. */
  message: ReactNode;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  const t = useTranslations("shared.states");

  return (
    <div role="alert" className="flex flex-col items-start gap-2 py-4">
      <p className="font-medium text-destructive">{t("errorHeading")}</p>
      <p>{message}</p>
      {onRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          {t("retry")}
        </Button>
      ) : null}
      {action}
    </div>
  );
}
