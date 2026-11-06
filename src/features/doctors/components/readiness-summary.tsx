import { CheckIcon, CircleHelpIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";
import type { ItemState, Readiness } from "../readiness";

const ICONS = {
  complete: CheckIcon,
  incomplete: XIcon,
  unknown: CircleHelpIcon,
} as const;

function Item({
  label,
  state,
  fix,
}: {
  label: string;
  state: ItemState;
  fix?: ReactNode;
}) {
  const t = useTranslations("doctors");
  const Icon = ICONS[state];
  const stateLabel = {
    complete: t("stateComplete"),
    incomplete: t("stateIncomplete"),
    unknown: t("stateUnknown"),
  }[state];

  return (
    <li className="flex flex-wrap items-center gap-2">
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>
        {label}
        {":"}
      </span>
      <strong className="font-medium">{stateLabel}</strong>
      {state === "incomplete" && fix ? fix : null}
    </li>
  );
}

const linkClass = "text-[0.8125rem] underline underline-offset-4";

/** Says each thing in words, never by color alone, and claims only what the API's answers support. */
export function ReadinessSummary({
  doctorId,
  readiness,
}: {
  doctorId: number;
  readiness: Readiness;
}) {
  const t = useTranslations("doctors");
  const { items, bookable, setupComplete, chargeWarning } = readiness;

  const bookableText = {
    true: t("bookable"),
    false: t("notBookable"),
    unknown: t("bookableUnknown"),
  }[String(bookable)];

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4 text-card-foreground">
      <h2 className="text-xl font-semibold">{t("readinessHeading")}</h2>
      <div role="status" className="flex flex-col gap-1 font-medium">
        <p>{bookableText}</p>
        {setupComplete === true ? <p>{t("setupComplete")}</p> : null}
        {setupComplete === "unknown" ? <p>{t("setupUnknown")}</p> : null}
        {chargeWarning ? (
          <p className="rounded-lg border border-status-warning-border bg-status-warning p-2 text-status-warning-foreground">
            {t("chargeWarning")}
          </p>
        ) : null}
      </div>
      <ul className="flex flex-col gap-1">
        <Item
          label={t("itemAccount")}
          state={items.account}
          fix={
            <Link href="/staff" prefetch={false} className={linkClass}>
              {t("fixAccount")}
            </Link>
          }
        />
        <Item
          label={t("itemHours")}
          state={items.hours}
          fix={
            <Link
              href={`/doctors/${doctorId}/schedule`}
              prefetch={false}
              className={linkClass}
            >
              {t("fixHours")}
            </Link>
          }
        />
        <Item
          label={t("itemSlots")}
          state={items.slots}
          fix={
            <span className="text-[0.8125rem] text-muted-foreground">
              {t("slotsHelp")}
            </span>
          }
        />
        <Item
          label={t("itemFee")}
          state={items.fee}
          fix={
            <a href={`#doctor-fee-${doctorId}`} className={linkClass}>
              {t("fixFee")}
            </a>
          }
        />
      </ul>
    </section>
  );
}
