"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChosenPatient, PatientChooser } from "@/features/patients/public";
import { readPositiveId } from "@/lib/api/read-positive-id";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";

/**
 * Sits outside the filter bar, because search terms must stay out of the address. Only the number chosen
 * goes in it. Choosing or showing a patient never reads their record, so no opening is written.
 */
export function AppointmentPatientFilter({ value }: { value?: string }) {
  const t = useTranslations("appointments.patientFilter");
  const tChosen = useTranslations("patients.chosen");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [choosing, setChoosing] = useState(false);

  // The dates go too, so that the default range for this choice applies.
  function hrefWith(patient: number | null): string {
    const query = new URLSearchParams(searchParams.toString());
    query.delete("from");
    query.delete("to");
    query.delete("page");
    if (patient === null) query.delete("patient_id");
    else query.set("patient_id", String(patient));
    const text = query.toString();
    return text ? `${pathname}?${text}` : pathname;
  }

  if (value) {
    const id = readPositiveId(value);
    const clear = (
      <Button variant="outline" size="sm" asChild>
        <Link href={hrefWith(null)} prefetch={false}>
          {t("clear")}
        </Link>
      </Button>
    );

    return (
      <section aria-label={t("heading")} className="flex flex-col gap-1.5">
        <p className="text-[0.8125rem] text-muted-foreground">{t("heading")}</p>
        {id === null ? (
          <div className="flex flex-wrap items-center gap-3">
            <p>{tChosen("notFound")}</p>
            {clear}
          </div>
        ) : (
          <ChosenPatient key={id} id={id} action={clear} />
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col items-start gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={choosing}
        onClick={() => setChoosing(!choosing)}
      >
        {choosing ? t("close") : t("open")}
      </Button>
      {choosing ? (
        <div className="w-full">
          <PatientChooser
            onChoose={(patient) => {
              setChoosing(false);
              router.push(hrefWith(patient.id));
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
