import { useLocale } from "next-intl";
import { formatInstant, parseInstant } from "@/lib/format/instant";
import { NoValue } from "./no-value";

export function Instant({
  value,
  timeZone,
  seconds = false,
}: {
  value: string | null | undefined;
  /** The clinic's time zone. It's server configuration, so it's passed in rather than guessed. */
  timeZone: string;
  seconds?: boolean;
}) {
  const locale = useLocale();
  const instant = parseInstant(value);
  if (instant === null) return <NoValue />;

  return (
    <bdi>
      <time dateTime={instant.toISOString()}>
        {formatInstant(instant, locale, timeZone, { seconds })}
      </time>
    </bdi>
  );
}
