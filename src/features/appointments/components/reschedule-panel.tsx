"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form/form-error";
import { Button } from "@/components/ui/button";
import { type FreeTime, FreeTimes } from "@/features/scheduling/public";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { rescheduleAppointment } from "../api/appointments";
import { allMessages, isAboutTheTime, isOutcomeUnknown } from "../refusal";
import type { Appointment } from "../types";

/** The same doctor, always: the API has no way to reassign, so no choice of doctor is offered (FR-018). */
export function ReschedulePanel({
  appointment,
  today,
  onDone,
  onRefused,
  onUnknownOutcome,
  onKeep,
}: {
  appointment: Appointment;
  today: string;
  onDone: () => void;
  onRefused: (messages: string[]) => void;
  onUnknownOutcome: () => void;
  onKeep: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("appointments.reschedule");
  const shared = useTranslations("shared.form");
  const router = useRouter();
  const [time, setTime] = useState<FreeTime | null>(null);
  const [timeError, setTimeError] = useState<string>();
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function move() {
    if (inFlight.current) return;
    if (!time) {
      setTimeError(t("chooseTime"));
      return;
    }
    inFlight.current = true;
    setWorking(true);
    setTimeError(undefined);
    setFormErrors([]);
    setBusyDate(null);

    const result = await rescheduleAppointment(appointment.id, time, locale);
    inFlight.current = false;
    setWorking(false);

    if (result.ok) {
      toast.success(t("moved"));
      onDone();
      router.refresh();
      return;
    }

    const { error } = result;
    if (isOutcomeUnknown(error)) {
      onUnknownOutcome();
      router.refresh();
      return;
    }
    // Nothing happened and nothing about the appointment is known to have changed, so this can be tried again.
    if (error.status === 500) {
      setFormErrors(allMessages(error, shared("generalFailure")));
      return;
    }
    if (!isAboutTheTime(error)) {
      onRefused(allMessages(error, shared("generalFailure")));
      router.refresh();
      return;
    }

    const onTime = [
      ...(error.fieldErrors.date ?? []),
      ...(error.fieldErrors.start ?? []),
    ];
    if (onTime.length > 0) setTimeError(onTime.join(" "));
    else setFormErrors(allMessages(error, shared("generalFailure")));
    if (error.reason === "patient_busy") setBusyDate(time.date);
    setTime(null);
    setRefreshSignal((count) => count + 1);
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <h2
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold outline-none"
      >
        {t("heading")}
      </h2>
      <p>
        {t("current", {
          date: appointment.date,
          start: appointment.start,
          end: appointment.end,
        })}
      </p>
      <p className="text-[0.8125rem] text-muted-foreground">
        {t("sameDoctor")}
      </p>
      <FormError messages={formErrors} />
      {busyDate ? (
        <p>
          <Link
            href={`/appointments?patient_id=${appointment.patient.id}&from=${busyDate}&to=${busyDate}`}
            prefetch={false}
            className="font-medium underline underline-offset-4"
          >
            {t("seePatient")}
          </Link>
        </p>
      ) : null}
      <FreeTimes
        doctorId={appointment.doctor.id}
        today={today}
        value={time}
        onChange={(next) => {
          setTime(next);
          if (next) setTimeError(undefined);
        }}
        refreshSignal={refreshSignal}
        error={timeError}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={working} onClick={() => void move()}>
          {working ? t("submitting") : t("submit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={working}
          onClick={onKeep}
        >
          {t("keep")}
        </Button>
      </div>
    </div>
  );
}
