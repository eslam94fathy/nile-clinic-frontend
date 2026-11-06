"use client";

import { useTranslations } from "next-intl";
import { useDirection } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";

export function Notices() {
  const direction = useDirection();
  const t = useTranslations("shared.notices");

  return (
    <Toaster
      dir={direction}
      containerAriaLabel={t("label")}
      toastOptions={{ closeButtonAriaLabel: t("close") }}
      position={direction === "rtl" ? "bottom-left" : "bottom-right"}
    />
  );
}
