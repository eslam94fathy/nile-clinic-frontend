import { getTranslations } from "next-intl/server";
import { SystemStatusView } from "./system-status-view";

export async function SystemStatusChecking({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "status" });

  return <SystemStatusView state="checking" label={t("checking")} />;
}
