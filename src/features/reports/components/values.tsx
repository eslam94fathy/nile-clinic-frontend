import { useLocale, useTranslations } from "next-intl";
import { toneClasses } from "@/components/shared/status-badge";
import { Money } from "@/components/shared/values/money";
import { Badge } from "@/components/ui/badge";
import { formatCount, formattingLocale } from "@/lib/format/locale";

// Every figure here is the API's, shown as sent. Nothing is added up or rounded beyond what's needed to write it
// (research R4).

/** For a figure the API sends as `null`. Never a zero, and never the dash, which reads as "nothing recorded". */
export function NotAvailable() {
  return <span>{useTranslations("reports")("notAvailable")}</span>;
}

/**
 * A percentage with one decimal, from the number sent. The division only lets `Intl` put the percent sign where
 * each language does; at one decimal the rounding gives back every value from 0.0 to 100.0.
 */
export function formatRate(value: number, locale: string): string {
  return new Intl.NumberFormat(formattingLocale(locale), {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

export function NoShowRate({ value }: { value: number | null }) {
  const locale = useLocale();
  if (value === null) return <NotAvailable />;
  return <bdi className="whitespace-nowrap">{formatRate(value, locale)}</bdi>;
}

/** How many visits a figure covers, such as "over 40 visits". */
export function VisitsCovered({ count }: { count: number }) {
  const t = useTranslations("reports");
  return (
    <>
      {t("visitsCovered", {
        count,
        formatted: formatCount(count, useLocale()),
      })}
    </>
  );
}

/** Whole minutes as sent, with the visits they cover, or "Not available" when no visit is covered. */
export function AverageMinutes({
  value,
  visits,
}: {
  value: number | null;
  visits: number;
}) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const average =
    value === null
      ? t("notAvailable")
      : new Intl.NumberFormat(formattingLocale(locale), {
          style: "unit",
          unit: "minute",
          unitDisplay: "long",
        }).format(value);

  return (
    <span>
      {t("averageWithVisits", {
        average,
        visits: t("visitsCovered", {
          count: visits,
          formatted: formatCount(visits, locale),
        }),
      })}
    </span>
  );
}

/** An amount that can be below zero, such as a net. The sign is written, and also said, never shown by color alone. */
export function SignedMoney({ value }: { value: string }) {
  const t = useTranslations("reports");
  return (
    <span>
      <Money value={value} />
      {value.startsWith("-") ? (
        <span className="sr-only">{` ${t("negative")}`}</span>
      ) : null}
    </span>
  );
}

export function Count({ value }: { value: number }) {
  return <>{formatCount(value, useLocale())}</>;
}

/** Marks a count worth following up, such as visits never charged. Text, not color, says so. */
export function NeedsAttention({ count }: { count: number }) {
  const t = useTranslations("reports");
  if (count <= 0) return null;

  return (
    <Badge
      variant="outline"
      data-tone="warning"
      className={`h-auto min-h-5 py-0.5 text-[0.8125rem] ${toneClasses.warning}`}
    >
      {t("needsAttention")}
    </Badge>
  );
}

/** A count, with the attention badge beside it when it's above zero. */
export function CountNeedingAttention({ value }: { value: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Count value={value} />
      <NeedsAttention count={value} />
    </span>
  );
}
