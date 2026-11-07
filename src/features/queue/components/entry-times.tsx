import { useTranslations } from "next-intl";
import { Instant } from "@/components/shared/values/instant";

/** Called, finished, and left, only where they exist. Times nobody has reached aren't mentioned. */
export function EntryTimes({
  entry,
  timeZone,
}: {
  entry: {
    called_at: string | null;
    finished_at: string | null;
    left_at: string | null;
  };
  timeZone: string;
}) {
  const t = useTranslations("queue.times");
  const times = [
    ["called", entry.called_at],
    ["finished", entry.finished_at],
    ["left", entry.left_at],
  ] as const;

  return (
    <div className="flex flex-col text-[0.8125rem]">
      {times.map(([key, value]) =>
        value ? (
          <span key={key}>
            {t(key)} <Instant value={value} timeZone={timeZone} />
          </span>
        ) : null,
      )}
    </div>
  );
}
