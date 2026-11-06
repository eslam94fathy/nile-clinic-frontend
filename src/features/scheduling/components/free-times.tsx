"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FormField } from "@/components/shared/form/form-field";
import { EmptyState } from "@/components/shared/states/empty-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { ClinicTime } from "@/components/shared/values/clinic-time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiError } from "@/lib/api/api-error";
import { useRouter } from "@/lib/i18n/navigation";
import { readFreeTimes } from "../api/slots";
import { freeTimeWindow } from "../free-time-window";
import type { Slot } from "../types";

export type FreeTime = Pick<Slot, "date" | "start">;

type Answer =
  | { kind: "reading" }
  | { kind: "failed"; error: ApiError }
  | { kind: "found"; slots: Slot[] };

/**
 * A doctor's free times for seven days, as the API offers them, grouped by day. Nothing is worked out here,
 * and nothing is polled: the API's answer on submitting decides. Native radios, so that the keyboard works
 * and each announces its date and time (FR-037).
 */
export function FreeTimes({
  doctorId,
  today,
  value,
  onChange,
  refreshSignal,
  error,
}: {
  doctorId: number;
  today: string;
  value: FreeTime | null;
  onChange: (time: FreeTime | null) => void;
  /** Changes when the times on screen may be out of date, such as after a refusal. */
  refreshSignal: number;
  error?: string | undefined;
}) {
  const locale = useLocale();
  const t = useTranslations("scheduling.freeTimes");
  const router = useRouter();
  const group = useId();
  // What's typed is kept apart from the dates read, as typing a year passes through dates that don't apply.
  const [typed, setTyped] = useState(today);
  const [answer, setAnswer] = useState<Answer>({ kind: "reading" });
  const [asked, setAsked] = useState(0);
  const newest = useRef(0);
  const current = useRef({ value, onChange });

  useEffect(() => {
    current.current = { value, onChange };
  });

  const window = freeTimeWindow(typed || today, today);
  const { from, to } = window;

  const read = useCallback(async () => {
    newest.current += 1;
    const request = newest.current;
    setAnswer({ kind: "reading" });

    const result = await readFreeTimes(doctorId, from, to, locale);
    if (request !== newest.current) return;

    if (!result.ok) {
      if (result.error.status === 403) router.refresh();
      setAnswer({ kind: "failed", error: result.error });
      return;
    }
    setAnswer({ kind: "found", slots: result.data });

    // A chosen time that's no longer on offer, or is in another week, can't stay chosen unseen.
    const chosen = current.current.value;
    if (
      chosen &&
      !result.data.some(
        (slot) => slot.date === chosen.date && slot.start === chosen.start,
      )
    ) {
      current.current.onChange(null);
    }
  }, [doctorId, from, to, locale, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this effect's job is to read from the API
    void read();
  }, [read, refreshSignal, asked]);

  const days = new Map<string, Slot[]>();
  if (answer.kind === "found") {
    for (const slot of answer.slots) {
      days.set(slot.date, [...(days.get(slot.date) ?? []), slot]);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-44">
          <FormField label={t("from")}>
            {(input) => (
              <Input
                {...input}
                type="date"
                min={today}
                max={freeTimeWindow("9999-12-31", today).from}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            )}
          </FormField>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={window.previous === undefined}
          onClick={() => setTyped(window.previous ?? today)}
        >
          {t("previousWeek")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={window.next === undefined}
          onClick={() => setTyped(window.next ?? from)}
        >
          {t("nextWeek")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setAsked((count) => count + 1)}
        >
          {t("refresh")}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {answer.kind === "reading" ? <LoadingState /> : null}
      {answer.kind === "failed" ? (
        <ApiFailureState
          error={answer.error}
          onRetry={() => setAsked((count) => count + 1)}
        />
      ) : null}
      {answer.kind === "found" && answer.slots.length === 0 ? (
        <div role="status">
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
            action={
              window.next === undefined ? undefined : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTyped(window.next ?? from)}
                >
                  {t("nextWeek")}
                </Button>
              )
            }
          />
        </div>
      ) : null}
      {answer.kind === "found" && answer.slots.length > 0 ? (
        <div
          role="group"
          aria-label={t("heading")}
          className="flex flex-col gap-4"
        >
          {[...days.entries()].map(([date, slots]) => (
            <fieldset key={date} className="flex flex-col gap-2">
              <legend className="mb-2 font-medium">
                <ClinicDate value={date} />
              </legend>
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <label
                    key={slot.start}
                    className="cursor-pointer rounded-lg border px-3 py-1.5 has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2"
                  >
                    <input
                      type="radio"
                      name={group}
                      className="sr-only"
                      aria-label={t("slotName", {
                        date: slot.date,
                        start: slot.start,
                        end: slot.end,
                      })}
                      checked={
                        value?.date === slot.date && value.start === slot.start
                      }
                      onChange={() =>
                        onChange({ date: slot.date, start: slot.start })
                      }
                    />
                    <ClinicTime value={slot.start} />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      ) : null}
    </div>
  );
}
