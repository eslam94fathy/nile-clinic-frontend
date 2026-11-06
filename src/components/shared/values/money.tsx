import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/format/money";
import { NoValue } from "./no-value";

export function Money({ value }: { value: string | null | undefined }) {
  const formatted = formatMoney(value, useLocale());
  if (formatted === null) return <NoValue />;

  // Isolated, but not forced left to right: that would put the Arabic currency on the wrong side.
  return <bdi className="whitespace-nowrap">{formatted}</bdi>;
}
