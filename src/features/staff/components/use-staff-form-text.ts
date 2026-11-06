"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { StaffFormText } from "../schemas/staff";

export function useStaffFormText(): StaffFormText {
  const t = useTranslations("staff");
  return useMemo(
    () => ({
      nameRequired: t("nameRequired"),
      emailRequired: t("emailRequired"),
      roleRequired: t("roleRequired"),
      lengthRule: t("lengthRule"),
      mismatch: t("mismatch"),
    }),
    [t],
  );
}
