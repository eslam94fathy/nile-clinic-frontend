"use client";

import { useTranslations } from "next-intl";
import { ErrorState } from "@/components/shared/states/error-state";

/** Inside the signed-in frame, which already has its `main`. */
export default function SignedInError({ retry }: { retry: () => void }) {
  const t = useTranslations("error");

  return <ErrorState message={t("description")} onRetry={() => retry()} />;
}
