"use client";

import { useLocale, useTranslations } from "next-intl";
import { ConfirmedAction } from "@/components/shared/confirmed-action";
import { removeTimeOff } from "../api/time-off";

export function RemoveTimeOff({
  doctorId,
  timeOffId,
}: {
  doctorId: number;
  timeOffId: number;
}) {
  const locale = useLocale();
  const t = useTranslations("scheduling");

  return (
    <ConfirmedAction
      label={t("remove")}
      title={t("removeTitle")}
      description={t("removeDescription")}
      confirmLabel={t("remove")}
      success={t("removed")}
      destructive
      action={() => removeTimeOff(doctorId, timeOffId, locale)}
    />
  );
}
