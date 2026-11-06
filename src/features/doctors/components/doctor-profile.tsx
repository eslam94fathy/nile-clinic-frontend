import { useLocale, useTranslations } from "next-intl";
import { StatusBadge } from "@/components/shared/status-badge";
import { LtrText } from "@/components/shared/values/ltr-text";
import { NoValue } from "@/components/shared/values/no-value";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { Can } from "@/features/app-shell/public";
import { Link } from "@/lib/i18n/navigation";
import { specialtyName } from "../specialty-name";
import type { Doctor } from "../types";

export function DoctorProfile({ doctor }: { doctor: Doctor }) {
  const locale = useLocale();
  const t = useTranslations("doctors");

  return (
    <section className="flex flex-col items-start gap-3">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{t("profileHeading")}</h2>
        <Can capability="manageDoctors">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/doctors/${doctor.id}/edit`} prefetch={false}>
              {t("edit")}
            </Link>
          </Button>
        </Can>
      </div>
      {doctor.is_active ? null : (
        <p role="status" className="font-medium">
          {t("inactiveNotice")}
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">{t("status")}</dt>
        <dd>
          <StatusBadge
            kind="activity"
            value={doctor.is_active ? "active" : "inactive"}
          />
        </dd>
        <dt className="text-muted-foreground">{t("fieldTitle")}</dt>
        <dd>
          <UserText>{doctor.title}</UserText>
        </dd>
        <dt className="text-muted-foreground">{t("registrationNumber")}</dt>
        <dd>
          {doctor.registration_number ? (
            <LtrText>{doctor.registration_number}</LtrText>
          ) : (
            <NoValue />
          )}
        </dd>
        <dt className="text-muted-foreground">{t("specialties")}</dt>
        <dd>
          <ul className="flex flex-col">
            {doctor.specialties.map((specialty) => (
              <li key={specialty.id}>
                <UserText>{specialtyName(specialty, locale)}</UserText>
              </li>
            ))}
          </ul>
        </dd>
      </dl>
    </section>
  );
}
