"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { UserText } from "@/components/shared/values/user-text";
import { specialtyName } from "../specialty-name";
import type { Specialty } from "../types";

/** Active specialties, plus any deactivated one a doctor already has, which may be kept. */
export function SpecialtyChoices({
  options,
  value,
  onChange,
  error,
}: {
  options: Specialty[];
  value: number[];
  onChange: (next: number[]) => void;
  error?: string | undefined;
}) {
  const locale = useLocale();
  const t = useTranslations("doctors");
  const shared = useTranslations("shared.form");
  const errorId = `${useId()}-error`;

  return (
    <fieldset
      className="flex flex-col gap-2"
      {...(error ? { "aria-describedby": errorId } : {})}
    >
      <legend className="mb-1.5 text-sm leading-none font-medium">
        {t("specialties")}{" "}
        <span className="font-normal text-muted-foreground">
          {shared("required")}
        </span>
      </legend>
      {options.map((specialty) => {
        const name = specialtyName(specialty, locale);
        return (
          <label key={specialty.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={value.includes(specialty.id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...value, specialty.id]
                    : value.filter((id) => id !== specialty.id),
                )
              }
            />
            <UserText>
              {specialty.is_active ? name : t("deactivatedSpecialty", { name })}
            </UserText>
          </label>
        );
      })}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-[0.8125rem] font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
