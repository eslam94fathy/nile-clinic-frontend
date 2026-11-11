import { useLocale, useTranslations } from "next-intl";
import { formatCount } from "@/lib/format/locale";
import { Link } from "@/lib/i18n/navigation";

export type Figure = {
  id: string;
  label: string;
  value: number;
  /** The list this figure counts, with its filter. */
  href?: string;
};

/**
 * Labelled counts, as text: a figure is never shown by color alone (FR-014). Zero is a figure, and is shown as one.
 * A linked figure says what it counts, as the number alone would be a poor name for a link.
 */
export function FigureList({ figures }: { figures: Figure[] }) {
  const locale = useLocale();
  const t = useTranslations("dashboard.panel");

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
      {figures.map(({ id, label, value, href }) => {
        const formatted = formatCount(value, locale);
        return (
          <div key={id} className="flex flex-col gap-0.5">
            <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold">
              {href ? (
                <Link
                  href={href}
                  prefetch={false}
                  aria-label={t("figureName", { label, value: formatted })}
                  className="underline-offset-4 hover:underline"
                >
                  <bdi>{formatted}</bdi>
                </Link>
              ) : (
                <bdi>{formatted}</bdi>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
