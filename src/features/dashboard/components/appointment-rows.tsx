import { useLocale, useTranslations } from "next-intl";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { TimeRange } from "@/components/shared/values/time-range";
import { UserText } from "@/components/shared/values/user-text";
import { formatCount } from "@/lib/format/locale";
import { Link } from "@/lib/i18n/navigation";
import type { ShortList } from "../types";

type Row = {
  id: number;
  date: string;
  start: string;
  end: string;
  patient: { full_name: string };
  doctor?: { name: string; title: string };
};

/**
 * A panel's short list of appointments, in the API's order. Each opens the appointment's own page, never the patient's
 * record, which would write an entry when opened (FR-012).
 */
export function AppointmentRows<R extends Row>({
  label,
  list,
  href,
  showDate = false,
}: {
  label: string;
  list: ShortList<R>;
  href: (id: number) => string;
  showDate?: boolean;
}) {
  const t = useTranslations("dashboard.panel");
  const locale = useLocale();
  const more = list.total - list.rows.length;

  return (
    <div className="flex flex-col gap-1">
      <ul aria-label={label} className="flex flex-col divide-y">
        {list.rows.map((row) => (
          <li key={row.id}>
            <Link
              href={href(row.id)}
              prefetch={false}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 hover:underline"
            >
              {showDate ? <ClinicDate value={row.date} /> : null}
              <TimeRange start={row.start} end={row.end} />
              <span className="font-medium">
                <UserText>{row.patient.full_name}</UserText>
              </span>
              {row.doctor ? (
                <span className="text-[0.8125rem] text-muted-foreground">
                  <UserText>{row.doctor.name}</UserText>
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {more > 0 ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          {t("andMore", { count: formatCount(more, locale) })}
        </p>
      ) : null}
    </div>
  );
}
