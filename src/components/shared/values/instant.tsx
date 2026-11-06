import { useLocale } from "next-intl";
import { formatInstant, parseInstant } from "@/lib/format/instant";
import { NoValue } from "./no-value";

export function Instant({
  value,
  timeZone,
}: {
  value: string | null | undefined;
  /** The clinic's time zone. It's server configuration, so it's passed in rather than guessed. */
  timeZone: string;
}) {
  const locale = useLocale();
  const instant = parseInstant(value);
  if (instant === null) return <NoValue />;

  return (
    <bdi>
      <time dateTime={instant.toISOString()}>
        {formatInstant(instant, locale, timeZone)}
      </time>
    </bdi>
  );
}
