import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/states/empty-state";
import { Instant } from "@/components/shared/values/instant";
import { Money } from "@/components/shared/values/money";
import { UserText } from "@/components/shared/values/user-text";
import type { DoctorFee } from "../types";

/** "No fee" is its own state, and never reads as zero. */
export function FeeDetails({
  fee,
  timeZone,
}: {
  fee: DoctorFee;
  timeZone: string;
}) {
  const t = useTranslations("fees");

  if (fee.amount === null) {
    return (
      <EmptyState title={t("noFeeTitle")} description={t("noFeeDescription")} />
    );
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
      <dt className="text-muted-foreground">{t("amount")}</dt>
      <dd className="font-medium">
        <Money value={fee.amount} />
      </dd>
      {fee.set_by ? (
        <>
          <dt className="text-muted-foreground">{t("setBy")}</dt>
          <dd>
            <UserText>{fee.set_by.name}</UserText>
          </dd>
        </>
      ) : null}
      <dt className="text-muted-foreground">{t("setAt")}</dt>
      <dd>
        <Instant value={fee.set_at} timeZone={timeZone} />
      </dd>
    </dl>
  );
}
