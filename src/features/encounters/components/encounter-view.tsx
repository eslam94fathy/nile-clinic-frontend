"use client";

import { useTranslations } from "next-intl";
import type { Ref } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Encounter } from "../types";
import { ClinicalText } from "./clinical-text";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Instant } from "@/components/shared/values/instant";

const SECTIONS = [
  ["chief_complaint", "chiefComplaint"],
  ["examination_findings", "examinationFindings"],
  ["diagnosis", "diagnosis"],
  ["treatment_plan", "treatmentPlan"],
] as const;

const LINE_LABELS = [
  ["dosage", "dosage"],
  ["frequency", "frequency"],
  ["duration", "duration"],
  ["instructions", "instructions"],
] as const;

/** A record's content, read only, exactly as written. Also used in the panel beside a draft. */
export function EncounterView({
  record,
  timeZone,
  headingRef,
}: {
  record: Encounter;
  timeZone: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const t = useTranslations("encounters");

  return (
    <div className="flex flex-col gap-5">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold outline-none"
      >
        {t("title")}
      </h2>
      <StatusBadge kind="record" value={record.status} />
      <p className="text-[0.8125rem] text-muted-foreground">
        {t("author")} {record.doctor.title} {record.doctor.name}
        {" · "}
        {t("visitDate")} <ClinicDate value={record.date} />
        {" · "}
        {t("started")} <Instant value={record.started_at} timeZone={timeZone} />
        {" · "}
        {t("lastSaved")}{" "}
        <Instant value={record.last_saved_at} timeZone={timeZone} />
        {record.finalized_at ? (
          <>
            {" · "}
            {t("finalized")}{" "}
            <Instant value={record.finalized_at} timeZone={timeZone} />
          </>
        ) : null}
      </p>
      {SECTIONS.map(([field, label]) => (
        <section key={field} className="flex flex-col gap-1">
          <h3 className="text-base font-semibold">{t(`form.${label}`)}</h3>
          <ClinicalText value={record[field]} />
        </section>
      ))}
      <section className="flex flex-col gap-2">
        <h3 className="text-base font-semibold">{t("view.linesHeading")}</h3>
        {record.prescriptions.length === 0 ? (
          <p className="text-muted-foreground">{t("view.noLines")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {record.prescriptions.map((line, index) => (
              <li key={index} className="rounded-lg border p-3">
                <p className="font-medium">
                  {t("form.lines.lineHeading", { number: String(index + 1) })}
                </p>
                <dl className="grid gap-1">
                  <div>
                    <dt className="text-[0.8125rem] text-muted-foreground">
                      {t("form.lines.medication")}
                    </dt>
                    <dd>
                      <ClinicalText value={line.medication} />
                    </dd>
                  </div>
                  {LINE_LABELS.map(([field, label]) => (
                    <div key={field}>
                      <dt className="text-[0.8125rem] text-muted-foreground">
                        {t(`form.lines.${label}`)}
                      </dt>
                      <dd>
                        <ClinicalText value={line[field]} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
