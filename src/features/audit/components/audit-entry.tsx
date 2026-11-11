"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Instant } from "@/components/shared/values/instant";
import { LtrText } from "@/components/shared/values/ltr-text";
import { UserText } from "@/components/shared/values/user-text";
import { useAuditLabels } from "../labels";
import {
  type AuditEntryActor,
  type AuditEntry as Entry,
  isAuditSubject,
} from "../types";
import { KnownStatus } from "./audit-value";
import { EntryChanges } from "./entry-changes";
import { EntryLink } from "./entry-link";
import { SearchedFilters } from "./searched-filters";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Actor({ actor }: { actor: AuditEntryActor }) {
  const t = useTranslations("audit.actors");
  const labels = useAuditLabels();

  if (actor.type === "system") return <span>{t("system")}</span>;
  // A type the contract doesn't list yet is shown as sent, not as a staff member (FR-012).
  if (actor.type !== "staff" && actor.type !== "unknown") {
    return <LtrText>{actor.type}</LtrText>;
  }
  if (actor.type === "unknown" || actor.id === null) {
    return <span>{t("unknown")}</span>;
  }

  const name = <UserText>{actor.name ?? String(actor.id)}</UserText>;
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <EntryLink type="staff_member" id={actor.id}>
        {name}
      </EntryLink>
      {actor.role ? (
        <span className="text-muted-foreground">
          {t("roleAtTime", { role: labels.role(actor.role) })}
        </span>
      ) : null}
    </span>
  );
}

/**
 * One entry of the trail, exactly as sent: when, what, by whom, on which record, for which patient, from where, and
 * what changed. Every absent part says "None" rather than leaving a gap.
 */
export function AuditEntry({
  entry,
  timeZone,
}: {
  entry: Entry;
  timeZone: string;
}) {
  const t = useTranslations("audit.entry");
  const labels = useAuditLabels();
  const none = <span>{t("none")}</span>;
  // A record type the contract doesn't list yet has no page and no kept-value rules, so its number is plain text.
  const subject =
    entry.subject && isAuditSubject(entry.subject.type)
      ? entry.subject.type
      : null;
  const refusedSignIn =
    entry.action === "auth.sign_in" &&
    entry.outcome === "refused" &&
    entry.actor.type === "staff";

  return (
    <article
      aria-label={labels.action(entry.action)}
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[0.8125rem] text-muted-foreground">
          <Instant value={entry.occurred_at} timeZone={timeZone} seconds />
        </span>
        <h2 className="font-semibold">{labels.action(entry.action)}</h2>
        <KnownStatus kind="outcome" value={entry.outcome} />
      </header>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[minmax(auto,12rem)_1fr]">
        <Row label={t("who")}>
          <Actor actor={entry.actor} />
          {refusedSignIn ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              {t("targetedAccount")}
            </p>
          ) : null}
        </Row>
        <Row label={t("record")}>
          {entry.subject ? (
            <span className="flex flex-wrap gap-x-1.5">
              <span>{labels.subject(entry.subject.type)}</span>
              {subject ? (
                <EntryLink type={subject} id={entry.subject.id} />
              ) : (
                <LtrText>{String(entry.subject.id)}</LtrText>
              )}
            </span>
          ) : (
            none
          )}
        </Row>
        <Row label={t("patient")}>
          {entry.patient_id === null ? (
            none
          ) : (
            <EntryLink type="patient" id={entry.patient_id} />
          )}
        </Row>
        <Row label={t("address")}>
          {entry.network_address === null ? (
            none
          ) : (
            <LtrText breakable>{entry.network_address}</LtrText>
          )}
        </Row>
        <Row label={t("changed")}>
          {entry.changes === null || entry.changes.fields.length === 0 ? (
            none
          ) : (
            <EntryChanges changes={entry.changes} subject={subject} />
          )}
        </Row>
        {entry.action === "audit.searched" ? (
          <Row label={t("filtersUsed")}>
            <SearchedFilters filters={entry.filters ?? {}} />
          </Row>
        ) : null}
      </dl>
    </article>
  );
}
