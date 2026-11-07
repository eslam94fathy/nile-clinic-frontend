import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import type { AppointmentFilters } from "../types";

function viewHref(filters: AppointmentFilters, needingMove: boolean): string {
  const query = new URLSearchParams();
  if (filters.doctor_id) query.set("doctor_id", filters.doctor_id);
  if (filters.patient_id) query.set("patient_id", filters.patient_id);
  if (needingMove) query.set("outside_availability", "1");
  const text = query.toString();
  return text ? `/appointments?${text}` : "/appointments";
}

/**
 * Links rather than a filter, so that the dates go and the default range applies, and so that nothing can
 * ask for "not outside availability" (FR-014).
 */
export function AppointmentViewLinks({
  filters,
}: {
  filters: AppointmentFilters;
}) {
  const t = useTranslations("appointments.views");
  const needingMove = Boolean(filters.outside_availability);

  return (
    <nav aria-label={t("label")} className="flex flex-wrap gap-2">
      <Button variant={needingMove ? "outline" : "default"} size="sm" asChild>
        <Link
          href={viewHref(filters, false)}
          prefetch={false}
          aria-current={needingMove ? undefined : "page"}
        >
          {t("all")}
        </Link>
      </Button>
      <Button variant={needingMove ? "default" : "outline"} size="sm" asChild>
        <Link
          href={viewHref(filters, true)}
          prefetch={false}
          aria-current={needingMove ? "page" : undefined}
        >
          {t("needingMove")}
        </Link>
      </Button>
    </nav>
  );
}
