import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/shared/states/error-state";
import { RetryButton } from "./retry-button";

/** The API is failing, which isn't a reason to end the session (FR-015). */
export function UnavailableState() {
  const t = useTranslations();

  return (
    <ErrorState
      message={t("auth.errors.unavailable")}
      action={<RetryButton label={t("shared.states.retry")} />}
    />
  );
}
