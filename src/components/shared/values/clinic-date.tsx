import { readClinicDate } from "@/lib/format/clinic-date";
import { NoValue } from "./no-value";

export function ClinicDate({ value }: { value: string | null | undefined }) {
  const date = readClinicDate(value);
  if (date === null) return <NoValue />;

  return (
    <bdi dir="ltr" className="whitespace-nowrap">
      <time dateTime={date}>{date}</time>
    </bdi>
  );
}
