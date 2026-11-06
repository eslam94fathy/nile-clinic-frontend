"use client";

import { useLocale, useTranslations } from "next-intl";
import { ConfirmedAction } from "@/components/shared/confirmed-action";
import { Button } from "@/components/ui/button";
import type { StaffMember } from "@/features/auth/public";
import { Link } from "@/lib/i18n/navigation";
import { setStaffActive } from "../api/staff";
import { SetPasswordForm } from "./set-password-form";

const heading = "text-xl font-semibold";

export function AccountActions({
  member,
  isSelf,
}: {
  member: StaffMember;
  isSelf: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("staff");

  return (
    <>
      {member.role === "doctor" && member.is_active ? (
        <section className="flex flex-col items-start gap-2">
          <h2 className={heading}>{t("doctorHeading")}</h2>
          <p className="text-muted-foreground">{t("doctorHint")}</p>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/doctors/new?account=${member.id}`} prefetch={false}>
              {t("createProfile")}
            </Link>
          </Button>
        </section>
      ) : null}

      <section className="flex flex-col items-start gap-2">
        <h2 className={heading}>{t("actionsHeading")}</h2>
        {member.is_active ? (
          <ConfirmedAction
            label={t("deactivate")}
            title={t("deactivateTitle", { name: member.name })}
            description={
              isSelf
                ? t("selfDeactivateDescription")
                : t("deactivateDescription")
            }
            confirmLabel={t("deactivate")}
            success={t("deactivated")}
            destructive
            action={() => setStaffActive(member.id, false, locale)}
          />
        ) : (
          <ConfirmedAction
            label={t("reactivate")}
            title={t("reactivateTitle", { name: member.name })}
            description={t("reactivateDescription")}
            confirmLabel={t("reactivate")}
            success={t("reactivated")}
            action={() => setStaffActive(member.id, true, locale)}
          />
        )}
      </section>

      <section className="flex flex-col items-start gap-3">
        {isSelf ? (
          <>
            <p className="text-muted-foreground">{t("ownPassword")}</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/account" prefetch={false}>
                {t("ownPasswordLink")}
              </Link>
            </Button>
          </>
        ) : (
          <>
            <h2 className={heading}>{t("passwordHeading")}</h2>
            <p className="text-muted-foreground">{t("passwordDescription")}</p>
            <SetPasswordForm id={member.id} name={member.name} />
          </>
        )}
      </section>
    </>
  );
}
