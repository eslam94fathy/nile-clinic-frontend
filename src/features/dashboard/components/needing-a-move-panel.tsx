"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import type { ListPolicy } from "@/lib/api/live-query";
import { readNeedingAMove } from "../api/dashboard";
import { dashboardLinks } from "../links";
import { usePanel } from "../use-panel";
import { AppointmentRows } from "./appointment-rows";
import { DashboardPanel } from "./dashboard-panel";
import { FigureList } from "./figure-list";

/** Upcoming appointments the API flags as outside their doctor's hours, for both the desk and administrators. */
export function NeedingAMovePanel({
  timeZone,
  policy,
}: {
  timeZone: string;
  policy: ListPolicy;
}) {
  const t = useTranslations("dashboard.move");
  const list = usePanel({
    panel: "needing-a-move",
    read: readNeedingAMove,
    timeZone,
    policy,
  });

  return (
    <DashboardPanel
      panel="needing-a-move"
      heading={t("heading")}
      link={{ href: dashboardLinks.appointmentsToMove, label: t("link") }}
      list={list}
      timeZone={timeZone}
      readsBySelf={policy.refetchInterval !== false}
    >
      {({ to, list: appointments }) => (
        <>
          <FigureList
            figures={[
              { id: "total", label: t("total"), value: appointments.total },
            ]}
          />
          <p className="text-[0.8125rem] text-muted-foreground">
            {t.rich("period", { to: () => <ClinicDate value={to} /> })}
          </p>
          {appointments.total === 0 ? (
            <EmptyState title={t("empty")} />
          ) : (
            <AppointmentRows
              label={t("listLabel")}
              list={appointments}
              href={dashboardLinks.appointment}
              showDate
            />
          )}
        </>
      )}
    </DashboardPanel>
  );
}
