import { getTranslations } from "next-intl/server";
import { StatusBadge } from "@/components/shared/status-badge";
import { PreviewSection } from "./preview-section";

export async function StatusSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "preview.statuses" });

  return (
    <PreviewSection heading={t("heading")}>
      <dl className="grid gap-x-6 gap-y-3 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        <dt className="text-muted-foreground">{t("appointment")}</dt>
        <dd className="flex flex-wrap gap-2">
          <StatusBadge kind="appointment" value="scheduled" />
          <StatusBadge kind="appointment" value="checked_in" />
          <StatusBadge kind="appointment" value="completed" />
          <StatusBadge kind="appointment" value="no_show" />
          <StatusBadge kind="appointment" value="cancelled" />
        </dd>
        <dt className="text-muted-foreground">{t("queue")}</dt>
        <dd className="flex flex-wrap gap-2">
          <StatusBadge kind="queue" value="waiting" />
          <StatusBadge kind="queue" value="with_doctor" />
          <StatusBadge kind="queue" value="seen" />
          <StatusBadge kind="queue" value="left" />
        </dd>
        <dt className="text-muted-foreground">{t("charge")}</dt>
        <dd className="flex flex-wrap gap-2">
          <StatusBadge kind="charge" value="none" />
          <StatusBadge kind="charge" value="partially_paid" />
          <StatusBadge kind="charge" value="paid" />
          <StatusBadge kind="charge" value="unpaid" />
          <StatusBadge kind="charge" value="cancelled" />
        </dd>
        <dt className="text-muted-foreground">{t("record")}</dt>
        <dd className="flex flex-wrap gap-2">
          <StatusBadge kind="record" value="none" />
          <StatusBadge kind="record" value="draft" />
          <StatusBadge kind="record" value="finalized" />
        </dd>
        <dt className="text-muted-foreground">{t("unknown")}</dt>
        <dd className="flex flex-wrap gap-2">
          {/* Deliberately not a valid value, which the type would otherwise refuse. */}
          <StatusBadge kind="queue" value={"on_mars" as never} />
        </dd>
      </dl>
    </PreviewSection>
  );
}
