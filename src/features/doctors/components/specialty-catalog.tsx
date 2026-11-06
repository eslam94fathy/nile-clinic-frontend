"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ConfirmedAction } from "@/components/shared/confirmed-action";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserText } from "@/components/shared/values/user-text";
import { Button } from "@/components/ui/button";
import { setSpecialtyActive } from "../api/specialties";
import type { Specialty } from "../types";
import { SpecialtyForm } from "./specialty-form";

const RENAME_ATTRIBUTE = "data-rename-specialty";

export function SpecialtyCatalog({
  specialties,
}: {
  specialties: Specialty[];
}) {
  const locale = useLocale();
  const t = useTranslations("specialties");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const returnFocusTo = useRef<number | null>(null);
  const renaming = specialties.find(({ id }) => id === renamingId);

  useEffect(() => {
    if (renamingId !== null || returnFocusTo.current === null) return;

    // The table and its narrow-screen cards each hold the button, and one of them is hidden.
    const buttons = document.querySelectorAll<HTMLElement>(
      `[${RENAME_ATTRIBUTE}="${returnFocusTo.current}"]`,
    );
    for (const button of buttons) {
      if (button.offsetParent !== null) button.focus();
    }
    returnFocusTo.current = null;
  }, [renamingId]);

  function displayName(specialty: Specialty) {
    return locale === "ar" ? specialty.name_ar : specialty.name_en;
  }

  const columns: DataTableColumn<Specialty>[] = [
    {
      id: "name_en",
      header: t("nameEn"),
      cell: (row) => <UserText>{row.name_en}</UserText>,
    },
    {
      id: "name_ar",
      header: t("nameAr"),
      cell: (row) => <UserText>{row.name_ar}</UserText>,
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <StatusBadge
          kind="activity"
          value={row.is_active ? "active" : "deactivated"}
        />
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            {...{ [RENAME_ATTRIBUTE]: row.id }}
            onClick={() => setRenamingId(row.id)}
          >
            {t("rename")}
          </Button>
          {row.is_active ? (
            <ConfirmedAction
              label={t("deactivate")}
              title={t("deactivateTitle", { name: displayName(row) })}
              description={t("deactivateDescription")}
              confirmLabel={t("deactivate")}
              success={t("deactivated")}
              destructive
              action={() => setSpecialtyActive(row.id, false, locale)}
            />
          ) : (
            <ConfirmedAction
              label={t("reactivate")}
              title={t("reactivateTitle", { name: displayName(row) })}
              description={t("reactivateDescription")}
              confirmLabel={t("reactivate")}
              success={t("reactivated")}
              action={() => setSpecialtyActive(row.id, true, locale)}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          {renaming ? t("rename") : t("addHeading")}
        </h2>
        {renaming ? (
          <SpecialtyForm
            key={renaming.id}
            specialty={renaming}
            onDone={() => {
              returnFocusTo.current = renaming.id;
              setRenamingId(null);
            }}
          />
        ) : (
          <SpecialtyForm />
        )}
      </section>
      <DataTable
        caption={t("caption")}
        columns={columns}
        rows={specialties}
        getRowKey={(row) => String(row.id)}
        state={specialties.length === 0 ? "empty" : "ready"}
        emptyState={
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        }
      />
    </>
  );
}
