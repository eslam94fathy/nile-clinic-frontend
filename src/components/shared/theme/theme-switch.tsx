"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ThemeChoice } from "./theme-constants";
import { setThemeChoice, useThemeChoice } from "./theme-store";

const choices: ThemeChoice[] = ["light", "dark", "device"];

export function ThemeSwitch() {
  const t = useTranslations("shared.theme");
  const current = useThemeChoice();

  return (
    <div role="group" aria-label={t("label")} className="flex gap-1">
      {choices.map((choice) => (
        <Button
          key={choice}
          type="button"
          size="xs"
          variant={current === choice ? "default" : "outline"}
          aria-pressed={current === choice}
          onClick={() => setThemeChoice(choice)}
        >
          {t(choice)}
        </Button>
      ))}
    </div>
  );
}
