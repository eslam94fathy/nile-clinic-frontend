import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/shared/states/error-state";
import { ForbiddenState } from "@/components/shared/states/forbidden-state";
import { NotFoundState } from "@/components/shared/states/not-found-state";
import type { ApiError } from "@/lib/api/api-error";
import { RetryButton } from "./retry-button";
import { SessionEndRedirect } from "./session-end-redirect";

/** What a screen, or one section of it, shows when a read fails. The API's `403` wins over the role map. */
export function ApiFailureState({
  error,
  onRetry,
}: {
  error: ApiError;
  /** Instead of the full reload, where a reload would lose what's held on the screen. */
  onRetry?: () => void;
}) {
  const t = useTranslations();

  if (error.status === 401) return <SessionEndRedirect />;
  if (error.status === 403) return <ForbiddenState />;
  if (error.status === 404) return <NotFoundState />;

  const message = error.message ?? t("auth.errors.unavailable");
  return onRetry ? (
    <ErrorState message={message} onRetry={onRetry} />
  ) : (
    <ErrorState
      message={message}
      action={<RetryButton label={t("shared.states.retry")} />}
    />
  );
}
