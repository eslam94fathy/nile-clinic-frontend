"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/states/error-state";
import { LoadingState } from "@/components/shared/states/loading-state";
import { UserText } from "@/components/shared/values/user-text";
import { ApiFailureState } from "@/features/auth/public";
import type { ApiResult } from "@/lib/api/api-error";
import { useRouter } from "@/lib/i18n/navigation";
import { useAuditedRead } from "@/lib/use-audited-read";
import { readHistory } from "../api/encounters";
import { historyOpening, takeHistoryName } from "../opening";
import type { HistoryPage } from "../types";
import { HistoryList } from "./history-list";
import { RecordLink } from "./record-link";

const noHandover = () => null;

/**
 * The page's reader. Each read writes a permanent `encounter.history_viewed`, per page, so it uses the guarded read
 * (ADR 0012). A refusal is one neutral state, saying nothing about whether records exist.
 */
export function PatientHistory({ patientId }: { patientId: number }) {
  const locale = useLocale();
  const t = useTranslations("encounters");
  const router = useRouter();
  const page = useRef(1);
  const [name, setName] = useState<string | null>(null);

  const { data, failure, reading, read, clearFailure } =
    useAuditedRead<HistoryPage>({
      id: patientId,
      read: (): Promise<ApiResult<HistoryPage>> =>
        readHistory(patientId, page.current, locale),
      takeAsked: historyOpening.takeAsked,
      takeHandedOver: noHandover,
      onFailure: (error) => {
        if (error.status === 403) router.refresh();
      },
    });

  // Set by the link that opened this page. It lives in memory, so a reload shows only the number.
  useEffect(() => {
    const passed = takeHistoryName(patientId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing with that outside value
    if (passed) setName(passed);
  }, [patientId]);

  if (!data) {
    return failure ? (
      <ApiFailureState
        error={failure}
        onRetry={() => {
          clearFailure();
          void read();
        }}
      />
    ) : (
      <LoadingState />
    );
  }

  return (
    <>
      <PageHeader
        title={t("history.title")}
        description={
          <>
            {name ? (
              <>
                <UserText>{name}</UserText>
                {" · "}
              </>
            ) : null}
            {t("patientLine", { number: String(patientId) })}
          </>
        }
      />
      <p className="text-[0.8125rem] text-muted-foreground">
        {t("history.description")}
      </p>
      {failure ? (
        <ErrorState message={failure.message ?? t("view.outOfDate")} />
      ) : null}
      <HistoryList
        items={data.data}
        meta={data.meta}
        reading={reading}
        onPage={(next) => {
          page.current = next;
          void read();
        }}
        renderOpen={(item) => (
          <RecordLink id={item.id}>{t("history.open")}</RecordLink>
        )}
      />
    </>
  );
}
