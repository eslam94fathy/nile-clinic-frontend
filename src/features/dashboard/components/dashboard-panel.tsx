"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { LastRead } from "@/components/shared/live/last-read";
import { ErrorState } from "@/components/shared/states/error-state";
import { ForbiddenState } from "@/components/shared/states/forbidden-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { NotFoundState } from "@/components/shared/states/not-found-state";
import { SessionEndRedirect } from "@/features/auth/public";
import type { LiveList } from "@/lib/api/use-live-list";
import { Link } from "@/lib/i18n/navigation";

/**
 * What every panel shares (contracts/screens.md): a section named by its heading, a way to the screen that owns its
 * figures, when they were read, and every state. A panel's failure stays inside it, so the rest of the dashboard
 * carries on (FR-006).
 */
export function DashboardPanel<Data>({
  panel,
  heading,
  link,
  list,
  timeZone,
  readsBySelf,
  notFound,
  children,
}: {
  panel: string;
  heading: string;
  link: { href: string; label: string };
  list: LiveList<Data>;
  timeZone: string;
  /** False on the administrator's dashboard, whose figures read only when asked (ADR 0019). */
  readsBySelf: boolean;
  /** What a `404` means here, where it means more than "nothing to show". */
  notFound?: ReactNode;
  children: (data: Data) => ReactNode;
}) {
  const t = useTranslations("dashboard.panel");
  const headingId = `dashboard-${panel}`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={headingId} className="text-lg font-semibold">
          {heading}
        </h2>
        <Link
          href={link.href}
          prefetch={false}
          className="text-[0.8125rem] font-medium underline underline-offset-4"
        >
          {link.label}
        </Link>
      </div>

      <PanelBody list={list} failed={t("failed")} notFound={notFound}>
        {children}
      </PanelBody>

      {list.data !== undefined ? (
        <LastRead
          readAt={list.readAt}
          outOfDate={list.outOfDate}
          retriesBySelf={readsBySelf}
          reading={list.reading}
          onRefresh={() => void list.refresh()}
          timeZone={timeZone}
        />
      ) : null}
    </section>
  );
}

function PanelBody<Data>({
  list,
  failed,
  notFound,
  children,
}: {
  list: LiveList<Data>;
  failed: string;
  notFound: ReactNode;
  children: (data: Data) => ReactNode;
}) {
  // Figures already shown stay, with LastRead's notice, when a later read fails.
  if (list.data !== undefined) return children(list.data);

  const failure = list.failure;
  if (!failure) return <LoadingState />;
  if (failure.status === 401) return <SessionEndRedirect />;
  if (failure.status === 403) return <ForbiddenState />;
  if (failure.status === 404) return notFound ?? <NotFoundState />;
  return (
    <ErrorState
      message={failure.message ?? failed}
      onRetry={() => void list.refresh()}
    />
  );
}
