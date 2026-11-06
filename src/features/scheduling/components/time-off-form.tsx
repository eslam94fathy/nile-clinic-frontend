"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/features/auth/public";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { useRouter } from "@/lib/i18n/navigation";
import { recordTimeOff } from "../api/time-off";
import {
  type TimeOffFormOutput,
  timeOffFormSchema,
  toTimeOffBody,
} from "../schemas/schedule";

// Only the fields on screen, so that an error for a hidden one goes to form level rather than being lost.
const WHOLE_FIELDS = ["start_date", "end_date", "reason"] as const;
const PART_FIELDS = ["start_date", "start_time", "end_time", "reason"] as const;

export function TimeOffForm({ doctorId }: { doctorId: number }) {
  const locale = useLocale();
  const t = useTranslations("scheduling");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const schema = useMemo(
    () =>
      timeOffFormSchema({
        dateRequired: t("dateRequired"),
        timeFormat: t("timeFormat"),
        reasonTooLong: t("reasonTooLong"),
      }),
    [t],
  );
  type FormInput = z.input<typeof schema>;
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, TimeOffFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: "whole",
      start_date: "",
      end_date: "",
      start_time: "",
      end_time: "",
      reason: "",
    },
  });
  const kind = useWatch({ control, name: "kind" });
  const { working, formErrors, submit } = useFormSubmit<FormInput>({
    fields: kind === "part" ? PART_FIELDS : WHOLE_FIELDS,
    setError,
    generalFailure: shared("generalFailure"),
  });

  function onSubmit(values: TimeOffFormOutput) {
    return submit(
      () => recordTimeOff(doctorId, toTimeOffBody(values), locale),
      () => {
        reset();
        toast.success(t("added"));
        router.refresh();
      },
    );
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-xl flex-col gap-4"
    >
      <FormError messages={formErrors} />
      <div className="max-w-xs">
        <FormField label={t("kind")}>
          {(input) => (
            <NativeSelect {...input} {...register("kind")} className="w-full">
              <NativeSelectOption value="whole">
                {t("kindWhole")}
              </NativeSelectOption>
              <NativeSelectOption value="part">
                {t("kindPart")}
              </NativeSelectOption>
            </NativeSelect>
          )}
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={t("startDate")}
          error={errors.start_date?.message}
          required
        >
          {(input) => (
            <Input
              {...input}
              {...register("start_date")}
              type="date"
              dir="ltr"
            />
          )}
        </FormField>
        {kind === "part" ? null : (
          <FormField
            label={t("endDate")}
            error={errors.end_date?.message}
            required
          >
            {(input) => (
              <Input
                {...input}
                {...register("end_date")}
                type="date"
                dir="ltr"
              />
            )}
          </FormField>
        )}
      </div>
      {kind === "part" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label={t("startTime")}
            hint={t("timeHint")}
            error={errors.start_time?.message}
            required
          >
            {(input) => (
              <Input
                {...input}
                {...register("start_time")}
                dir="ltr"
                inputMode="numeric"
                placeholder="10:00"
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField
            label={t("endTime")}
            error={errors.end_time?.message}
            required
          >
            {(input) => (
              <Input
                {...input}
                {...register("end_time")}
                dir="ltr"
                inputMode="numeric"
                placeholder="12:00"
                autoComplete="off"
              />
            )}
          </FormField>
        </div>
      ) : null}
      <FormField
        label={t("reasonLabel")}
        hint={t("reasonHint")}
        error={errors.reason?.message}
        noMedicalDetails
      >
        {(input) => (
          <Textarea {...input} {...register("reason")} dir="auto" rows={2} />
        )}
      </FormField>
      <p className="text-[0.8125rem] text-muted-foreground">
        {t("appointmentsNote")}
      </p>
      <div>
        <Button type="submit" disabled={!hydrated || working}>
          {working ? t("adding") : t("add")}
        </Button>
      </div>
    </form>
  );
}
