"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { type Path, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmedAction } from "@/components/shared/confirmed-action";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/features/auth/public";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { useRouter } from "@/lib/i18n/navigation";
import { clearSchedule, saveSchedule } from "../api/schedule";
import {
  insertionIndex,
  type ScheduleFormInput,
  scheduleToFormValues,
} from "../schedule-form-values";
import {
  type ScheduleFormOutput,
  scheduleFormSchema,
} from "../schemas/schedule";
import { DAYS, type Schedule } from "../types";

const MAX_PERIODS_PER_DAY = 4;
const timeInput = "w-24 text-center";

export function ScheduleEditor({
  doctorId,
  schedule,
}: {
  doctorId: number;
  schedule: Schedule;
}) {
  const locale = useLocale();
  const t = useTranslations("scheduling");
  const dayNames = useTranslations("days");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const schema = useMemo(
    () =>
      scheduleFormSchema({
        minutesRule: t("minutesRule"),
        timeFormat: t("timeFormat"),
      }),
    [t],
  );
  const defaults = useMemo(() => scheduleToFormValues(schedule), [schedule]);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ScheduleFormInput, unknown, ScheduleFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });
  const { fields, insert, remove } = useFieldArray({
    control,
    name: "periods",
  });

  // Each row's own keys: `periods.N` from the rules between periods, and the rest from their formats.
  const knownErrors = useMemo<Path<ScheduleFormInput>[]>(
    () => [
      "appointment_minutes",
      "periods",
      ...fields.flatMap((_, index) => [
        `periods.${index}` as const,
        `periods.${index}.day` as const,
        `periods.${index}.start` as const,
        `periods.${index}.end` as const,
      ]),
    ],
    [fields],
  );
  const { working, formErrors, submit } = useFormSubmit<ScheduleFormInput>({
    fields: knownErrors,
    setError,
    generalFailure: shared("generalFailure"),
  });

  function onSubmit(values: ScheduleFormOutput) {
    return submit(
      () => saveSchedule(doctorId, values, locale),
      () => {
        toast.success(t("saved"));
        router.push(`/doctors/${doctorId}`);
        // Pages opened before this change are still mounted, and this is what updates them (ADR 0011).
        router.refresh();
      },
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        method="post"
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormError messages={formErrors} />
        <div className="max-w-xs">
          <FormField
            label={t("appointmentMinutes")}
            hint={t("appointmentHint")}
            error={errors.appointment_minutes?.message}
            required
          >
            {(input) => (
              // `defaultValue`, so that the current value is there before hydration.
              <Input
                {...input}
                {...register("appointment_minutes")}
                defaultValue={defaults.appointment_minutes}
                dir="ltr"
                inputMode="numeric"
                autoComplete="off"
              />
            )}
          </FormField>
        </div>
        <p className="text-[0.8125rem] text-muted-foreground">
          {t("timeHint")}
        </p>
        {errors.periods?.message ? (
          <p role="alert" className="font-medium text-destructive">
            {errors.periods.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          {DAYS.map((day) => {
            const dayName = dayNames(day);
            const rows = fields.flatMap((field, index) =>
              field.day === day ? [{ field, index }] : [],
            );
            const full = rows.length >= MAX_PERIODS_PER_DAY;

            return (
              <section
                key={day}
                className="flex flex-col gap-2 rounded-lg bg-card p-3 text-card-foreground"
              >
                <h3 className="font-medium">{dayName}</h3>
                {rows.length === 0 ? (
                  <p className="text-[0.8125rem] text-muted-foreground">
                    {t("dayOff")}
                  </p>
                ) : null}
                {rows.map(({ field, index }, position) => {
                  const number = position + 1;
                  const rowError = errors.periods?.[index];
                  return (
                    <div
                      key={field.id}
                      data-period-row
                      className="flex flex-col gap-1"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <FormField
                          label={t("startOf", { number, day: dayName })}
                          error={rowError?.start?.message}
                          required
                        >
                          {(input) => (
                            <Input
                              {...input}
                              {...register(`periods.${index}.start`)}
                              defaultValue={field.start}
                              dir="ltr"
                              inputMode="numeric"
                              placeholder="09:00"
                              autoComplete="off"
                              className={timeInput}
                            />
                          )}
                        </FormField>
                        <FormField
                          label={t("endOf", { number, day: dayName })}
                          error={rowError?.end?.message}
                          required
                        >
                          {(input) => (
                            <Input
                              {...input}
                              {...register(`periods.${index}.end`)}
                              defaultValue={field.end}
                              dir="ltr"
                              inputMode="numeric"
                              placeholder="13:00"
                              autoComplete="off"
                              className={timeInput}
                            />
                          )}
                        </FormField>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="self-end"
                          onClick={() => remove(index)}
                        >
                          {t("removePeriod", { number, day: dayName })}
                        </Button>
                      </div>
                      {rowError?.message || rowError?.day?.message ? (
                        <p
                          role="alert"
                          className="text-[0.8125rem] font-medium text-destructive"
                        >
                          {rowError.message ?? rowError.day?.message}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={full}
                    onClick={() => {
                      const index = insertionIndex(fields, day);
                      insert(
                        index,
                        { day, start: "", end: "" },
                        { focusName: `periods.${index}.start` },
                      );
                    }}
                  >
                    {t("addPeriodOn", { day: dayName })}
                  </Button>
                  {full ? (
                    <span className="text-[0.8125rem] text-muted-foreground">
                      {t("tooManyPeriods")}
                    </span>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>

        <p className="text-muted-foreground">{t("appointmentsNote")}</p>
        <div>
          <Button type="submit" disabled={!hydrated || working}>
            {working ? t("saving") : t("save")}
          </Button>
        </div>
      </form>

      {schedule.appointment_minutes === null ? null : (
        <div>
          <ConfirmedAction
            label={t("clear")}
            title={t("clearTitle")}
            description={t("clearDescription")}
            confirmLabel={t("clear")}
            success={t("cleared")}
            destructive
            action={() => clearSchedule(doctorId, locale)}
          />
        </div>
      )}
    </div>
  );
}
