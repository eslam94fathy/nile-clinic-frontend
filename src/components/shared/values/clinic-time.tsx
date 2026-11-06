import { readClinicTime } from "@/lib/format/clinic-time";
import { NoValue } from "./no-value";

export function ClinicTime({ value }: { value: string | null | undefined }) {
  const time = readClinicTime(value);
  if (time === null) return <NoValue />;

  // Not a <time> element, since `24:00` isn't a valid value for its `dateTime`.
  return (
    <bdi dir="ltr" className="whitespace-nowrap">
      {time}
    </bdi>
  );
}
