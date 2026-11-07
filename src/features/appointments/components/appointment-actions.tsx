"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { checkInAppointment } from "@/features/queue/public";
import { allMessages, isOutcomeUnknown } from "@/lib/api/refusal";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { cancelAppointment, markNoShow } from "../api/appointments";
import { offeredActions } from "../offered-actions";
import { cancelBody, cancelReasonSchema } from "../schemas/appointment";
import type { Appointment } from "../types";
import { DETAILS_HEADING_ID } from "./appointment-details";
import { ConfirmedChange } from "./confirmed-change";
import { ReschedulePanel } from "./reschedule-panel";

/** The control pressed may be gone once the page has refreshed, so focus goes somewhere that stays. */
function focusHeading() {
  document.getElementById(DETAILS_HEADING_ID)?.focus();
}

/**
 * What's offered depends on the status and the clinic's clock, as `clinicNow` was when the page rendered.
 * This only decides what's shown: the API's refusal appears here, and the page then shows the current state.
 */
export function AppointmentActions({
  appointment,
  today,
  clinicNow,
}: {
  appointment: Appointment;
  today: string;
  clinicNow: string;
}) {
  const locale = useLocale();
  const t = useTranslations("appointments");
  const tCancel = useTranslations("appointments.cancel");
  const tNoShow = useTranslations("appointments.noShow");
  const [notices, setNotices] = useState<string[]>([]);
  const [rescheduling, setRescheduling] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [checkingIn, setCheckingIn] = useState(false);
  const shared = useTranslations("shared.form");
  const router = useRouter();
  const rescheduleButton = useRef<HTMLButtonElement>(null);
  const expectingChange = useRef(false);
  const checkInFlight = useRef(false);

  const offered = offeredActions(
    appointment.status,
    appointment.date,
    appointment.start,
    clinicNow,
  );
  const version = `${appointment.status} ${appointment.date} ${appointment.start}`;

  // Runs once the refreshed appointment has arrived, which is what may have removed the control.
  useEffect(() => {
    if (!expectingChange.current) return;
    expectingChange.current = false;
    focusHeading();
  }, [version]);

  function refused(messages: string[]) {
    setNotices(messages);
    setRescheduling(false);
    expectingChange.current = true;
    focusHeading();
  }

  const unknownOutcome = () => refused([t("actions.unknownOutcome")]);

  function changed() {
    setNotices([]);
    setRescheduling(false);
    expectingChange.current = true;
    focusHeading();
  }

  // No confirmation: a mistake can be put right by undoing it from the queue, and the desk does this all day.
  async function checkIn() {
    if (checkInFlight.current) return;
    checkInFlight.current = true;
    setCheckingIn(true);
    setNotices([]);

    const result = await checkInAppointment(appointment.id, locale);
    checkInFlight.current = false;
    setCheckingIn(false);

    if (result.ok) {
      toast.success(
        t("checkIn.done", { number: String(result.data.queue_number) }),
      );
      changed();
    } else if (isOutcomeUnknown(result.error)) {
      unknownOutcome();
    } else {
      refused(allMessages(result.error, shared("generalFailure")));
    }
    router.refresh();
  }

  const reasonSchema = cancelReasonSchema({
    reasonTooLong: tCancel("reasonTooLong"),
  });

  return (
    <section className="flex flex-col gap-3">
      <FormError messages={notices} />
      {appointment.status === "checked_in" &&
      // Lists only cover today, so an earlier day's check-in wouldn't be on it.
      clinicNow.startsWith(`${appointment.date} `) ? (
        <p>
          <Link
            href={`/queue?doctor_id=${appointment.doctor.id}`}
            prefetch={false}
            className="font-medium underline underline-offset-4"
          >
            {t("checkIn.seeList")}
          </Link>
        </p>
      ) : null}
      {rescheduling ? (
        <ReschedulePanel
          appointment={appointment}
          today={today}
          onDone={changed}
          onRefused={refused}
          onUnknownOutcome={unknownOutcome}
          onKeep={() => {
            setRescheduling(false);
            // The panel held the focus, and closing it removes that.
            requestAnimationFrame(() => rescheduleButton.current?.focus());
          }}
        />
      ) : offered.length > 0 ? (
        <>
          <h2 className="text-xl font-semibold">{t("actions.heading")}</h2>
          <div className="flex flex-wrap gap-2">
            {offered.includes("check_in") ? (
              <Button
                type="button"
                aria-disabled={checkingIn}
                onClick={() => void checkIn()}
              >
                {checkingIn ? t("checkIn.working") : t("checkIn.action")}
              </Button>
            ) : null}
            {offered.includes("reschedule") ? (
              <Button
                ref={rescheduleButton}
                type="button"
                onClick={() => {
                  setNotices([]);
                  setRescheduling(true);
                }}
              >
                {t("actions.reschedule")}
              </Button>
            ) : null}
            {offered.includes("cancel") ? (
              <ConfirmedChange
                label={t("actions.cancel")}
                title={tCancel("title")}
                description={tCancel("description")}
                confirmLabel={tCancel("confirm")}
                success={tCancel("done")}
                check={() => {
                  const parsed = reasonSchema.safeParse({ reason });
                  if (parsed.success) return true;
                  setReasonError(parsed.error.issues[0]?.message);
                  return false;
                }}
                action={() =>
                  cancelAppointment(
                    appointment.id,
                    cancelBody(reason.trim()),
                    locale,
                  )
                }
                onFieldError={(error) => {
                  const messages = error.fieldErrors.reason;
                  if (!messages) return false;
                  setReasonError(messages.join(" "));
                  return true;
                }}
                onReset={() => {
                  setReason("");
                  setReasonError(undefined);
                }}
                onDone={changed}
                onRefused={refused}
                onUnknownOutcome={unknownOutcome}
              >
                <FormField
                  label={tCancel("reasonLabel")}
                  error={reasonError}
                  noMedicalDetails
                >
                  {(input) => (
                    <Textarea
                      {...input}
                      dir="auto"
                      rows={2}
                      autoComplete="off"
                      // Sized by its rows, as unbroken text would otherwise widen the dialog past the screen.
                      className="field-sizing-fixed"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  )}
                </FormField>
              </ConfirmedChange>
            ) : null}
            {offered.includes("no_show") ? (
              <ConfirmedChange
                label={t("actions.noShow")}
                title={tNoShow("title")}
                description={tNoShow("description")}
                confirmLabel={tNoShow("confirm")}
                success={tNoShow("done")}
                action={() => markNoShow(appointment.id, locale)}
                onDone={changed}
                onRefused={refused}
                onUnknownOutcome={unknownOutcome}
              />
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
