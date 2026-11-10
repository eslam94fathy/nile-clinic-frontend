"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { Money } from "@/components/shared/values/money";
import { formatMoney } from "@/lib/format/money";
import { chartColumns } from "../chart-columns";
import type { MoneyCollected } from "../types";

// Columns follow the reading direction because they're a flex row: the first day sits at the inline start in both
// languages. Positive nets rise from the zero line, negative ones hang below it, with a hatched fill, so the sign
// shows by position and pattern as well as color (ADR 0017). Every figure is also in the table that follows.

const HATCH =
  "bg-[repeating-linear-gradient(135deg,var(--chart-negative)_0_3px,transparent_3px_5px)]";

export function MoneyByDayChart({
  from,
  to,
  byDay,
}: {
  from: string;
  to: string;
  byDay: MoneyCollected["by_day"];
}) {
  const t = useTranslations("reports.money");
  const locale = useLocale();
  // By date, so a new read or period never moves the highlight to another day.
  const [hovered, setHovered] = useState<string | null>(null);
  const model = chartColumns({ from, to, byDay });
  if (model === null) return null;

  const { columns, upperShare, topLabel, bottomLabel } = model;
  const shown = columns.find(({ date }) => date === hovered) ?? null;
  // Columns shrink to nothing but gaps don't, so long periods have narrower gaps, or none, to fit a phone.
  const gap = columns.length > 92 ? 0 : columns.length > 31 ? 1 : 2;
  const describe = (date: string, net: string | null) =>
    t("chartDay", {
      date,
      net: net === null ? t("noMovement") : (formatMoney(net, locale) ?? ""),
    });

  return (
    <figure className="flex flex-col gap-2 rounded-lg bg-card p-4 text-card-foreground">
      {/* One image for assistive technology: the table below is how to read every figure. */}
      <div
        role="img"
        aria-label={t("chartLabel", { from, to })}
        className="flex flex-col gap-1"
      >
        {/* The hovered day's figure. Kept at one line's height, so the chart doesn't move. */}
        <p
          aria-hidden="true"
          className="min-h-5 text-[0.8125rem] text-muted-foreground"
        >
          {shown ? describe(shown.date, shown.net) : null}
        </p>
        {topLabel ? (
          <p
            aria-hidden="true"
            className="text-[0.8125rem] text-muted-foreground"
          >
            <Money value={topLabel} />
          </p>
        ) : null}
        <div
          aria-hidden="true"
          className="relative flex h-48 items-stretch"
          style={{ columnGap: `${String(gap)}px` }}
          onPointerLeave={() => setHovered(null)}
        >
          {/* The zero line: a hairline in the border token, across every column. */}
          <div
            className="pointer-events-none absolute inset-x-0 h-px bg-border"
            style={{ top: `${upperShare * 100}%` }}
          />
          {columns.map((column) => (
            <div
              key={column.date}
              title={describe(column.date, column.net)}
              onPointerEnter={() => setHovered(column.date)}
              // The whole height is the target, bigger than the column itself.
              className="flex max-w-6 min-w-0 flex-1 flex-col"
            >
              <div
                className="flex flex-col justify-end"
                style={{ height: `${upperShare * 100}%` }}
              >
                {!column.below && column.share > 0 ? (
                  <div
                    className={`rounded-t-[4px] bg-chart-positive ${hovered === column.date ? "outline-2 outline-foreground" : ""}`}
                    style={{ height: `${column.share * 100}%` }}
                  />
                ) : null}
              </div>
              <div
                className="flex flex-col justify-start"
                style={{ height: `${(1 - upperShare) * 100}%` }}
              >
                {column.below ? (
                  <div
                    className={`rounded-b-[4px] border border-chart-negative ${HATCH} ${hovered === column.date ? "outline-2 outline-foreground" : ""}`}
                    style={{ height: `${column.share * 100}%` }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {bottomLabel ? (
          <p
            aria-hidden="true"
            className="text-[0.8125rem] text-muted-foreground"
          >
            <Money value={bottomLabel} />
          </p>
        ) : null}
        <div
          aria-hidden="true"
          className="flex justify-between text-[0.8125rem] text-muted-foreground"
        >
          <ClinicDate value={from} />
          <ClinicDate value={to} />
        </div>
      </div>
    </figure>
  );
}
