"use client";

import { useTranslations } from "next-intl";
import { useRef } from "react";
import {
  type Control,
  type FieldErrors,
  useFieldArray,
  type UseFormRegister,
} from "react-hook-form";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLINICAL_INPUT } from "../clinical-input";
import { EMPTY_LINE } from "../form-values";
import {
  type EncounterFormValues,
  LINE_FIELDS,
  type LineValues,
  MOST_LINES,
} from "../types";

const LABELS: Record<keyof LineValues, string> = {
  medication: "medication",
  dosage: "dosage",
  frequency: "frequency",
  duration: "duration",
  instructions: "instructions",
};

export function PrescriptionLines({
  control,
  register,
  errors,
  locked,
}: {
  control: Control<EncounterFormValues>;
  register: UseFormRegister<EncounterFormValues>;
  errors: FieldErrors<EncounterFormValues>;
  locked: boolean;
}) {
  const t = useTranslations("encounters.form.lines");
  const { fields, append, remove } = useFieldArray({
    control,
    name: "prescriptions",
  });
  const addButton = useRef<HTMLButtonElement>(null);

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-base font-semibold">{t("heading")}</legend>
      <p className="text-[0.8125rem] text-muted-foreground">{t("hint")}</p>
      {fields.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : null}
      {fields.map((line, index) => {
        const number = String(index + 1);
        return (
          <div
            key={line.id}
            role="group"
            aria-label={t("lineHeading", { number })}
            className="flex flex-col gap-3 rounded-lg border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{t("lineHeading", { number })}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={locked}
                onClick={() => {
                  remove(index);
                  // The button pressed has gone, so focus would otherwise fall to the page's start.
                  addButton.current?.focus();
                }}
              >
                {t("remove", { number })}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {LINE_FIELDS.map((field) => {
                const error = errors.prescriptions?.[index]?.[field]?.message;
                return (
                  <FormField
                    key={field}
                    label={t(LABELS[field])}
                    {...(error ? { error } : {})}
                  >
                    {(input) => (
                      <Input
                        {...input}
                        {...CLINICAL_INPUT}
                        readOnly={locked}
                        {...register(`prescriptions.${index}.${field}`)}
                      />
                    )}
                  </FormField>
                );
              })}
            </div>
          </div>
        );
      })}
      <div>
        <Button
          ref={addButton}
          type="button"
          variant="outline"
          disabled={locked || fields.length >= MOST_LINES}
          onClick={() => append({ ...EMPTY_LINE })}
        >
          {t("add")}
        </Button>
      </div>
    </fieldset>
  );
}
