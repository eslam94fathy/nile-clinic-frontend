"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/features/auth/public";
import {
  DoctorChooser,
  type DoctorSummary,
  type Specialty,
} from "@/features/doctors/public";
import {
  ChosenPatient,
  PatientChooser,
  type PatientSummary,
} from "@/features/patients/public";
import { type FreeTime, FreeTimes } from "@/features/scheduling/public";
import type { ApiError } from "@/lib/api/api-error";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { bookAppointment } from "../api/appointments";
import { isAboutTheTime, isOutcomeUnknown } from "../refusal";
import { bookingNoteSchema, toBookingBody } from "../schemas/appointment";

/** Only the note is typed. The rest are places for the API's refusals to appear. */
type FormValues = {
  note: string;
  patient_id?: number;
  doctor_id?: number;
  date?: string;
  start?: string;
};
const FIELDS = ["patient_id", "doctor_id", "date", "start", "note"] as const;

type ChosenPerson = { id: number; known?: PatientSummary };

const LINK = "font-medium underline underline-offset-4";
const STEP_HEADING = "text-xl font-semibold outline-none";

/**
 * Patient, then doctor, then time, in order. Nothing here reads a patient's record, so booking writes no
 * opening. The API decides everything: a time can be taken at any moment, so a refusal is an ordinary path,
 * and keeps what was chosen and typed (research R6).
 */
export function BookingForm({
  today,
  specialties,
  carriedPatient,
  carriedInvalid,
}: {
  today: string;
  specialties: Specialty[];
  /** From a link on the patient's page. */
  carriedPatient: number | null;
  /** A value in the address that can't be a patient number. */
  carriedInvalid: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("appointments.booking");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const [patient, setPatient] = useState<ChosenPerson | null>(
    carriedPatient === null ? null : { id: carriedPatient },
  );
  const [patientMissing, setPatientMissing] = useState(carriedInvalid);
  const [doctor, setDoctor] = useState<DoctorSummary | null>(null);
  const [time, setTime] = useState<FreeTime | null>(null);
  const [needsTime, setNeedsTime] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  // Choosing and changing remove the button pressed, so focus goes to a heading that stays.
  const patientHeading = useRef<HTMLHeadingElement>(null);
  const doctorHeading = useRef<HTMLHeadingElement>(null);
  const timeHeading = useRef<HTMLHeadingElement>(null);

  const schema = useMemo(
    () => bookingNoteSchema({ noteTooLong: t("noteTooLong") }),
    [t],
  );
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<FormValues, unknown, { note: string }>({
    resolver: zodResolver(schema),
    defaultValues: { note: "" },
  });
  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<FormValues>({
      fields: FIELDS,
      setError,
      generalFailure: shared("generalFailure"),
    });

  // This page stays held, and the link that opened it still means this patient.
  function startOver() {
    reset();
    // The same patient stays known, as nothing reads them again.
    setPatient((chosen) =>
      carriedPatient === null
        ? null
        : chosen?.id === carriedPatient
          ? chosen
          : { id: carriedPatient },
    );
    setPatientMissing(false);
    setDoctor(null);
    setTime(null);
    setNeedsTime(false);
    setBusyDate(null);
    setUncertain(false);
    setFormErrors([]);
  }

  // What the last attempt said was about that patient and doctor, and its links would now mean someone else.
  function forgetAttempt() {
    setNeedsTime(false);
    setBusyDate(null);
    setUncertain(false);
    setFormErrors([]);
  }

  function onFailure(error: ApiError, date: string) {
    if (isOutcomeUnknown(error)) {
      setFormErrors([]);
      setUncertain(true);
      return;
    }
    if (!isAboutTheTime(error)) return;

    if (error.reason === "patient_busy") setBusyDate(date);
    setTime(null);
    setRefreshSignal((count) => count + 1);
  }

  function onSubmit({ note }: { note: string }) {
    if (!patient?.known || !doctor) return;
    if (!time) {
      setNeedsTime(true);
      return;
    }

    setBusyDate(null);
    setUncertain(false);
    const body = toBookingBody({
      patient_id: patient.id,
      doctor_id: doctor.id,
      date: time.date,
      start: time.start,
      note,
    });
    return submit(
      () => bookAppointment(body, locale),
      (booked) => {
        toast.success(t("booked"));
        startOver();
        router.push(`/appointments/${booked.id}`);
        router.refresh();
      },
      (error) => onFailure(error, time.date),
    );
  }

  const timeErrors = [errors.date?.message, errors.start?.message]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 ref={patientHeading} tabIndex={-1} className={STEP_HEADING}>
          {t("patientStep")}
        </h2>
        {errors.patient_id?.message ? (
          <FormError messages={[errors.patient_id.message]} />
        ) : null}
        {patient ? (
          <ChosenPatient
            key={patient.id}
            id={patient.id}
            known={patient.known}
            onFound={(found) => setPatient({ id: found.id, known: found })}
            onMissing={() => {
              setPatient(null);
              setPatientMissing(true);
            }}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPatient(null);
                  forgetAttempt();
                  clearErrors(["patient_id", "date", "start"]);
                  patientHeading.current?.focus();
                }}
              >
                {t("change")}
              </Button>
            }
          />
        ) : (
          <>
            {patientMissing ? <p role="alert">{t("patientMissing")}</p> : null}
            <PatientChooser
              onChoose={(chosen) => {
                setPatient({ id: chosen.id, known: chosen });
                setPatientMissing(false);
                clearErrors("patient_id");
                doctorHeading.current?.focus();
              }}
            />
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 ref={doctorHeading} tabIndex={-1} className={STEP_HEADING}>
          {t("doctorStep")}
        </h2>
        {errors.doctor_id?.message ? (
          <FormError messages={[errors.doctor_id.message]} />
        ) : null}
        {!patient?.known ? (
          <p className="text-muted-foreground">{t("chooseDoctorFirst")}</p>
        ) : doctor ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <p className="min-w-0">
              <bdi dir="auto" className="font-medium">
                {doctor.name}
              </bdi>
              {" · "}
              <bdi dir="auto">{doctor.title}</bdi>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDoctor(null);
                setTime(null);
                forgetAttempt();
                clearErrors(["doctor_id", "date", "start"]);
                doctorHeading.current?.focus();
              }}
            >
              {t("change")}
            </Button>
          </div>
        ) : (
          <DoctorChooser
            specialties={specialties}
            onChoose={(chosen) => {
              setDoctor(chosen);
              setTime(null);
              clearErrors("doctor_id");
              timeHeading.current?.focus();
            }}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 ref={timeHeading} tabIndex={-1} className={STEP_HEADING}>
          {t("timeStep")}
        </h2>
        {!patient?.known || !doctor ? (
          <p className="text-muted-foreground">{t("chooseTimeFirst")}</p>
        ) : (
          <>
            <FreeTimes
              doctorId={doctor.id}
              today={today}
              value={time}
              onChange={(next) => {
                setTime(next);
                if (next) {
                  setNeedsTime(false);
                  clearErrors(["date", "start"]);
                }
              }}
              refreshSignal={refreshSignal}
              error={timeErrors || (needsTime ? t("chooseTime") : undefined)}
            />
            {/* Only the note and the button: the steps above have fields that mustn't submit this. */}
            <form
              noValidate
              onSubmit={handleSubmit(onSubmit)}
              className="flex max-w-xl flex-col gap-4"
            >
              <FormError messages={formErrors} />
              {uncertain ? (
                <div role="alert" className="flex flex-col gap-1">
                  <p className="font-medium">{t("unknownOutcome")}</p>
                  <p>
                    <Link
                      href={`/appointments?patient_id=${patient.id}`}
                      prefetch={false}
                      className={LINK}
                    >
                      {t("seeAppointments")}
                    </Link>
                  </p>
                </div>
              ) : null}
              {busyDate ? (
                <p>
                  <Link
                    href={`/appointments?patient_id=${patient.id}&from=${busyDate}&to=${busyDate}`}
                    prefetch={false}
                    className={LINK}
                  >
                    {t("seePatient")}
                  </Link>
                </p>
              ) : null}
              <FormField
                label={t("noteLabel")}
                error={errors.note?.message}
                noMedicalDetails
              >
                {(input) => (
                  <Textarea
                    {...input}
                    {...register("note")}
                    dir="auto"
                    rows={2}
                    autoComplete="off"
                    className="field-sizing-fixed"
                  />
                )}
              </FormField>
              <div>
                <Button type="submit" disabled={!hydrated || working}>
                  {working ? t("submitting") : t("submit")}
                </Button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
