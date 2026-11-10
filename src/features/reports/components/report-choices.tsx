"use client";

import { useTranslations } from "next-intl";
import { FilterBar } from "@/components/shared/filter-bar";
import { FormError } from "@/components/shared/form/form-error";
import type { ApiError } from "@/lib/api/api-error";
import type { DateRange } from "@/lib/format/date-range";
import { Link } from "@/lib/i18n/navigation";
import { reportHref } from "../report-href";
import { SHORTCUTS, type Shortcut } from "../shortcuts";
import type { Report, ReportFilters } from "../types";

export type DoctorOption = { id: number; name: string; is_active: boolean };

/** Everything the choices need, worked out on the server, as the clinic's calendar lives there. */
export type ReportChoicesProps = {
  report: Report;
  filters: ReportFilters;
  /** `null` when they couldn't be read: the reports still work, for all doctors. */
  doctors: DoctorOption[] | null;
  shortcuts: Record<Shortcut, DateRange>;
  currentShortcut: Shortcut | null;
  /** The default period's dates, for the fields and for Reset. */
  defaultPeriod: DateRange;
};

const FIELDS = new Set(["from", "to", "doctor_id"]);

const PROBLEM_MESSAGE = {
  missing_from: "missingFrom",
  missing_to: "missingTo",
  reversed: "reversed",
  too_long: "tooLong",
} as const;

/**
 * The period and doctor, shared by the four reports through the address (FR-003). A problem the frontend can see
 * is shown on its date, and nothing is read until it's corrected; the API's own refusal is shown the same way.
 */
export function ReportChoices({
  report,
  filters,
  doctors,
  shortcuts,
  currentShortcut,
  defaultPeriod,
  refusal = null,
}: ReportChoicesProps & {
  /** The read's `422`, if it was refused. */
  refusal?: ApiError | null;
}) {
  const t = useTranslations("reports.choices");
  const tRange = useTranslations("reports.range");
  const { doctorId, rangeProblem } = filters;

  const fieldErrors = refusal?.status === 422 ? refusal.fieldErrors : {};
  const errors: Record<string, string> = Object.fromEntries(
    Object.entries(fieldErrors)
      .filter(([key]) => FIELDS.has(key))
      .map(([key, messages]) => [key, messages.join(" ")]),
  );
  if (rangeProblem) {
    errors[rangeProblem === "missing_from" ? "from" : "to"] = tRange(
      PROBLEM_MESSAGE[rangeProblem],
    );
  }
  const others = Object.entries(fieldErrors)
    .filter(([key]) => !FIELDS.has(key))
    .flatMap(([, messages]) => messages);
  const formLevel =
    refusal?.status === 422 &&
    others.length === 0 &&
    Object.keys(errors).length === 0
      ? [refusal.message ?? ""].filter(Boolean)
      : others;

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        applyLabel={t("apply")}
        errors={errors}
        filters={[
          {
            name: "from",
            label: t("from"),
            type: "date",
            inAddress: true,
            // Only for the default period: a missing date stays empty beside the error that asks for it.
            defaultValue: rangeProblem ? undefined : defaultPeriod.from,
          },
          {
            name: "to",
            label: t("to"),
            type: "date",
            inAddress: true,
            defaultValue: rangeProblem ? undefined : defaultPeriod.to,
          },
          {
            name: "doctor_id",
            label: t("doctor"),
            type: "select",
            inAddress: true,
            ...(doctors ? {} : { hint: t("doctorsUnavailable") }),
            options: [
              { value: "", label: t("allDoctors") },
              ...(doctors
                ? doctors.map((doctor) => ({
                    value: String(doctor.id),
                    label: doctor.is_active
                      ? doctor.name
                      : t("inactiveDoctor", { name: doctor.name }),
                  }))
                : // Without this, a report for one doctor would look like everyone's.
                  doctorId !== null
                  ? [{ value: String(doctorId), label: String(doctorId) }]
                  : []),
            ],
          },
        ]}
      />
      <FormError messages={formLevel} />
      <nav aria-label={t("shortcutsLabel")}>
        <ul className="flex flex-wrap gap-2">
          {SHORTCUTS.map((name) => {
            const isCurrent = name === currentShortcut;
            return (
              <li key={name}>
                <Link
                  href={reportHref(report, {
                    period: shortcuts[name],
                    doctorId,
                  })}
                  aria-current={isCurrent ? "true" : undefined}
                  className={
                    isCurrent
                      ? // Marked by a filled shape and weight as well as color.
                        "inline-flex min-h-8 items-center rounded-md border border-primary bg-primary px-3 text-sm font-semibold text-primary-foreground"
                      : "inline-flex min-h-8 items-center rounded-md border border-input px-3 text-sm hover:bg-accent hover:text-accent-foreground"
                  }
                >
                  {t(`shortcuts.${name}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
