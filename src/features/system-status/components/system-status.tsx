import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { getEnv } from "@/lib/config/env";
import { formatInstant } from "@/lib/format/instant";
import { checkHealth } from "../api/check-health";
import { SystemStatusView } from "./system-status-view";

export async function SystemStatus({ locale }: { locale: string }) {
  // Runs per request, never at build time or from a prerendered shell.
  await connection();

  const [status, t] = await Promise.all([
    checkHealth(locale),
    getTranslations({ locale, namespace: "status" }),
  ]);

  return (
    <SystemStatusView
      state={status}
      label={t(status)}
      detail={t("checkedAt", {
        time: formatInstant(new Date(), locale, getEnv().CLINIC_TIMEZONE),
      })}
      retry={{ checkAgain: t("checkAgain"), checking: t("checking") }}
    />
  );
}
