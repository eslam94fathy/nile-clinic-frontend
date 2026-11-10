import type { ReactNode } from "react";

export type Figure = { id: string; label: string; value: ReactNode };

/**
 * A report's totals, as a list of labelled figures rather than a table row, so paging can never move them
 * (research R6). Wraps from one column on a phone to several on a desktop.
 */
export function FigureList({
  heading,
  level = 2,
  figures,
}: {
  heading?: string;
  /** Below another heading, such as a method within "By method", pass 3. */
  level?: 2 | 3;
  figures: Figure[];
}) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-card p-4 text-card-foreground">
      {heading ? <Heading className="font-semibold">{heading}</Heading> : null}
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-6 gap-y-3">
        {figures.map((figure) => (
          <div key={figure.id} className="flex flex-col gap-0.5">
            <dt className="text-[0.8125rem] text-muted-foreground">
              {figure.label}
            </dt>
            <dd className="text-lg font-semibold [overflow-wrap:anywhere]">
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
