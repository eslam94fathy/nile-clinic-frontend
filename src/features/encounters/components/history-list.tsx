"use client";

import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/states/empty-state";
import { ClinicDate } from "@/components/shared/values/clinic-date";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import type { PageMeta } from "@/lib/api/pagination";
import type { EncounterHistoryItem } from "../types";

/**
 * Rows of a date, a doctor, and their specialties, with no clinical content, as the API sends. Each further page
 * writes its own entry, so it's a person's action, and it isn't in the address.
 */
export function HistoryList({
  items,
  meta,
  reading,
  onPage,
  renderOpen,
}: {
  items: EncounterHistoryItem[];
  meta: PageMeta;
  reading: boolean;
  onPage: (page: number) => void;
  renderOpen: (item: EncounterHistoryItem) => ReactNode;
}) {
  const locale = useLocale();
  const t = useTranslations("encounters.history");

  if (items.length === 0) {
    return (
      <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul aria-label={t("caption")} className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
          >
            <div className="flex flex-col">
              <span className="font-medium">
                <ClinicDate value={item.date} />
              </span>
              <span>
                <UserText>{item.doctor.name}</UserText>
              </span>
              <span className="text-[0.8125rem] text-muted-foreground">
                {item.doctor.specialties
                  .map((specialty) =>
                    locale === "ar" ? specialty.name_ar : specialty.name_en,
                  )
                  .join(" · ")}
              </span>
            </div>
            {renderOpen(item)}
          </li>
        ))}
      </ul>
      {meta.last_page > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reading || meta.current_page <= 1}
            onClick={() => onPage(meta.current_page - 1)}
          >
            {t("previous")}
          </Button>
          <span className="text-[0.8125rem] text-muted-foreground">
            <LtrText>
              {t("pageLine", {
                page: String(meta.current_page),
                last: String(meta.last_page),
              })}
            </LtrText>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reading || meta.current_page >= meta.last_page}
            onClick={() => onPage(meta.current_page + 1)}
          >
            {t("next")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
