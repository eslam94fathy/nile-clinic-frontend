import { ClinicTime } from "@/components/shared/values/clinic-time";

/** Times read left to right in every language, and are shown exactly as sent, including `24:00`. */
export function TimeRange({ start, end }: { start: string; end: string }) {
  return (
    <bdi dir="ltr" className="whitespace-nowrap">
      <ClinicTime value={start} />
      {" – "}
      <ClinicTime value={end} />
    </bdi>
  );
}
