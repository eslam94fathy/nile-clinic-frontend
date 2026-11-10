import { toPiastres } from "@/lib/format/amount";
import { addDays } from "@/lib/format/clinic-today";
import { daysIncluding } from "@/lib/format/date-range";
import type { MoneyCollected } from "./types";

export type ChartColumn = {
  date: string;
  /** The API's net for the day, or `null` for a day it left out, which had no money movement. */
  net: string | null;
  /** The column's length as a share of its side of the zero line, from 0 to 1. Labels nothing. */
  share: number;
  below: boolean;
};

export type ChartModel = {
  columns: ChartColumn[];
  /** The share of the chart's height above the zero line. */
  upperShare: number;
  /** The API's own strings for the largest net on each side, to label the scale. */
  topLabel: string | null;
  bottomLabel: string | null;
};

/** The API's limit, and so the most columns there can be. */
const MAX_COLUMNS = 366;

/**
 * Net money by day, as columns from `from` to `to` (research R5, ADR 0017). Sizes come from exact whole piastres, so
 * a column can't disagree with its day's figure, and nothing shown is worked out here. `null` when there is nothing
 * to draw: no day in `byDay`, or every net zero.
 */
export function chartColumns({
  from,
  to,
  byDay,
}: {
  from: string;
  to: string;
  byDay: MoneyCollected["by_day"];
}): ChartModel | null {
  const nets = new Map(byDay.map((day) => [day.date, day.net]));
  const piastresOf = (net: string | null) =>
    net === null ? 0 : (toPiastres(net) ?? 0);

  let maxUp = 0;
  let maxDown = 0;
  let topLabel: string | null = null;
  let bottomLabel: string | null = null;
  for (const { net } of byDay) {
    const piastres = piastresOf(net);
    if (piastres > maxUp) {
      maxUp = piastres;
      topLabel = net;
    }
    if (-piastres > maxDown) {
      maxDown = -piastres;
      bottomLabel = net;
    }
  }
  if (maxUp === 0 && maxDown === 0) return null;

  const count = Math.min(Math.max(daysIncluding(from, to), 1), MAX_COLUMNS);
  const columns: ChartColumn[] = [];
  for (let index = 0; index < count; index += 1) {
    const date = addDays(from, index);
    const net = nets.get(date) ?? null;
    const piastres = piastresOf(net);
    columns.push({
      date,
      net,
      share:
        piastres > 0
          ? piastres / maxUp
          : piastres < 0
            ? -piastres / maxDown
            : 0,
      below: piastres < 0,
    });
  }

  return {
    columns,
    upperShare: maxUp / (maxUp + maxDown),
    topLabel,
    bottomLabel,
  };
}
