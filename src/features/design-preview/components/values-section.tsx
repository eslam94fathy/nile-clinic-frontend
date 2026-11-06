import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { ClinicTime } from "@/components/shared/values/clinic-time";
import { Instant } from "@/components/shared/values/instant";
import { LtrText } from "@/components/shared/values/ltr-text";
import { Money } from "@/components/shared/values/money";
import { UserText } from "@/components/shared/values/user-text";
import { sampleValues as v } from "../synthetic-data";
import { ClientValues } from "./client-values";
import { PreviewSection } from "./preview-section";

export async function ValuesSection({
  locale,
  timeZone,
}: {
  locale: string;
  timeZone: string;
}) {
  const t = await getTranslations({ locale, namespace: "preview.values" });

  const rows: [string, ReactNode][] = [
    [t("money"), <Money key="money" value={v.money} />],
    [t("moneyNegative"), <Money key="negative" value={v.moneyNegative} />],
    [t("moneyLarge"), <Money key="large" value={v.moneyLarge} />],
    [t("moneyNull"), <Money key="null" value={null} />],
    [t("moneyMalformed"), <Money key="bad" value={v.moneyMalformed} />],
    [t("date"), <ClinicDate key="date" value={v.date} />],
    [t("dateMalformed"), <ClinicDate key="badDate" value={v.dateMalformed} />],
    [t("time"), <ClinicTime key="time" value={v.time} />],
    [t("timeEndOfDay"), <ClinicTime key="end" value={v.timeEndOfDay} />],
    [
      t("instantLong"),
      <Instant key="long" value={v.instantLong} timeZone={timeZone} />,
    ],
    [
      t("instantOffset"),
      <Instant key="offset" value={v.instantOffset} timeZone={timeZone} />,
    ],
    [t("phone"), <LtrText key="phone">{v.phone}</LtrText>],
    [t("nationalId"), <LtrText key="id">{v.nationalId}</LtrText>],
    [t("userTextLatin"), <UserText key="latin">{v.userTextLatin}</UserText>],
    [t("userTextArabic"), <UserText key="arabic">{v.userTextArabic}</UserText>],
  ];

  return (
    <PreviewSection heading={t("heading")}>
      <dl className="grid gap-x-6 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="[overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      <h3 className="font-semibold">{t("browserHeading")}</h3>
      <ClientValues
        label={t("browserHeading")}
        money={v.money}
        date={v.date}
        time={v.time}
        instant={v.instantLong}
        timeZone={timeZone}
      />
      <h3 className="font-semibold">{t("sentenceHeading")}</h3>
      <p data-testid="value-sentence">
        {t.rich("sentence", {
          money: () => <Money value={v.money} />,
          date: () => <ClinicDate value={v.date} />,
          time: () => <ClinicTime value={v.time} />,
          phone: () => <LtrText>{v.phone}</LtrText>,
        })}
      </p>
    </PreviewSection>
  );
}
