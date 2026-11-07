"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormError } from "@/components/shared/form/form-error";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
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
import { isOutcomeUnknown } from "@/lib/api/refusal";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { addWalkIn } from "../api/queue";

/** Nothing is typed. These are places for the API's refusals to appear. */
type FormValues = { patient_id?: number; doctor_id?: number };
const FIELDS = ["patient_id", "doctor_id"] as const;

type ChosenPerson = { id: number; known?: PatientSummary };

const STEP_HEADING = "text-xl font-semibold outline-none";

/**
 * Patient, then doctor. Nothing here reads a patient's record, so adding a walk-in writes no opening. A refusal
 * keeps what was chosen, as the API decides who can be added (research R8).
 */
export function WalkInForm({
  specialties,
  carriedPatient,
  carriedInvalid,
}: {
  specialties: Specialty[];
  /** From the link on the patient's page. */
  carriedPatient: number | null;
  /** A value in the address that can't be a patient number. */
  carriedInvalid: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("queue.walkInForm");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const [patient, setPatient] = useState<ChosenPerson | null>(
    carriedPatient === null ? null : { id: carriedPatient },
  );
  const [patientMissing, setPatientMissing] = useState(carriedInvalid);
  const [doctor, setDoctor] = useState<DoctorSummary | null>(null);
  const [uncertain, setUncertain] = useState(false);
  // Choosing and changing remove the button pressed, so focus goes to a heading that stays.
  const patientHeading = useRef<HTMLHeadingElement>(null);
  const doctorHeading = useRef<HTMLHeadingElement>(null);

  const {
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>();
  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<FormValues>({
      fields: FIELDS,
      setError,
      generalFailure: shared("generalFailure"),
    });

  function forgetAttempt() {
    setUncertain(false);
    setFormErrors([]);
    clearErrors();
  }

  // This page stays held, and the link that opened it still means this patient.
  function startOver() {
    forgetAttempt();
    setPatient((chosen) =>
      carriedPatient === null
        ? null
        : chosen?.id === carriedPatient
          ? chosen
          : { id: carriedPatient },
    );
    setPatientMissing(false);
    setDoctor(null);
  }

  function onSubmit() {
    if (!patient?.known || !doctor) return;
    setUncertain(false);

    return submit(
      () => addWalkIn({ patient_id: patient.id, doctor_id: doctor.id }, locale),
      (entry) => {
        toast.success(t("added", { number: String(entry.queue_number) }));
        startOver();
        router.push("/queue");
      },
      (error) => {
        if (!isOutcomeUnknown(error)) return;
        setFormErrors([]);
        setUncertain(true);
      },
    );
  }

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
          <p className="text-muted-foreground">{t("choosePatientFirst")}</p>
        ) : doctor ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <p className="min-w-0">
              <span className="font-medium">
                <UserText>{doctor.name}</UserText>
              </span>
              {" · "}
              <UserText>{doctor.title}</UserText>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDoctor(null);
                forgetAttempt();
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
              clearErrors("doctor_id");
              doctorHeading.current?.focus();
            }}
          />
        )}
      </section>

      {patient?.known && doctor ? (
        <form
          noValidate
          onSubmit={(event) => {
            // With nothing to validate here, a refusal left in place would stop the next attempt from sending.
            clearErrors();
            return handleSubmit(onSubmit)(event);
          }}
          className="flex max-w-xl flex-col gap-4"
        >
          <p>{t("permanent")}</p>
          <FormError messages={formErrors} />
          {uncertain ? (
            <div role="alert" className="flex flex-col gap-1">
              <p className="font-medium">{t("unknownOutcome")}</p>
              <p>
                <Link
                  href="/queue"
                  prefetch={false}
                  className="font-medium underline underline-offset-4"
                >
                  {t("seeQueue")}
                </Link>
              </p>
            </div>
          ) : null}
          <div>
            <Button type="submit" disabled={!hydrated || working}>
              {working ? t("submitting") : t("submit")}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
