"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FilterValues } from "@/components/shared/filter-bar";
import type { ApiError } from "@/lib/api/api-error";
import { toWesternDigits } from "@/lib/format/digits";
import { useRouter } from "@/lib/i18n/navigation";
import { type PatientPage, searchPatients } from "./api/patients";
import { changeCount } from "./opening";
import { normalizeNationalId, normalizePhone } from "./schemas/patient";
import type { PatientSearchTerms } from "./types";

export type PatientAnswer =
  | { kind: "none" }
  | { kind: "reading" }
  | { kind: "failed"; error: ApiError }
  | { kind: "found"; page: PatientPage };

const toTerms = (values: FilterValues): PatientSearchTerms => ({
  name: values.name ?? "",
  phone: normalizePhone(values.phone ?? ""),
  id: toWesternDigits(values.id ?? "").trim(),
  national_id: normalizeNationalId(values.national_id ?? ""),
});

const SEARCH_FIELDS = new Set(["name", "phone", "id", "national_id"]);

export function searchFieldErrors(
  answer: PatientAnswer,
): Partial<Record<string, string>> {
  if (answer.kind !== "failed" || answer.error.status !== 422) return {};

  return Object.fromEntries(
    Object.entries(answer.error.fieldErrors)
      .filter(([key]) => SEARCH_FIELDS.has(key))
      .map(([key, messages]) => [key, messages.join(" ")]),
  );
}

/** Whatever a `422` said that has no field of its own. None of it may be dropped. */
export function otherRefusals(error: ApiError, fallback: string): string[] {
  const keys = Object.keys(error.fieldErrors);
  if (keys.length === 0) return [error.message ?? fallback];

  return keys
    .filter((key) => !SEARCH_FIELDS.has(key))
    .flatMap((key) => error.fieldErrors[key] ?? []);
}

/**
 * Finds patients in the browser, because a term can't reach the server without entering the address, which
 * must never hold one (constitution II, ADR 0012). Everything is held in the component using this, so going
 * back to a held page restores it and a reload clears it. Lists aren't audited, but nobody is listed until a
 * person searches for someone (FR-001, FR-003 of Phase 5).
 */
export function usePatientSearch() {
  const locale = useLocale();
  const router = useRouter();
  const [answer, setAnswer] = useState<PatientAnswer>({ kind: "none" });
  const [needsTerm, setNeedsTerm] = useState(false);
  const newest = useRef(0);
  const last = useRef<{ terms: PatientSearchTerms; page: number } | null>(null);
  const changesSeen = useRef(changeCount());
  const paging = useRef(false);
  const results = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (terms: PatientSearchTerms, page: number) => {
      newest.current += 1;
      const request = newest.current;
      last.current = { terms, page };
      setNeedsTerm(false);
      setAnswer({ kind: "reading" });

      let result = await searchPatients(terms, page, locale);
      // A change can leave fewer pages than there were, and "no patients match" would then be untrue.
      if (
        request === newest.current &&
        page > 1 &&
        result.ok &&
        result.data.data.length === 0
      ) {
        last.current = { terms, page: 1 };
        result = await searchPatients(terms, 1, locale);
      }
      if (request !== newest.current) return;

      // This person may no longer see patients, so the terms go too, and the gate and navigation re-decide.
      if (!result.ok && result.error.status === 403) {
        last.current = null;
        router.refresh();
      }
      setAnswer(
        result.ok
          ? { kind: "found", page: result.data }
          : { kind: "failed", error: result.error },
      );
    },
    [locale, router],
  );

  const forget = () => {
    newest.current += 1;
    last.current = null;
    setAnswer({ kind: "none" });
  };

  // This runs again each time a held page is shown, so a patient changed elsewhere shows here too (FR-020).
  useEffect(() => {
    const changes = changeCount();
    if (changes === changesSeen.current) return;
    changesSeen.current = changes;

    if (last.current) void run(last.current.terms, last.current.page);
  }, [run]);

  // Paging replaces the button that was pressed, so keyboard focus would otherwise fall to the page's start.
  useEffect(() => {
    if (!paging.current || answer.kind === "reading") return;
    paging.current = false;
    results.current?.focus();
  }, [answer]);

  return {
    answer,
    needsTerm,
    results,
    search: (values: FilterValues) => {
      const terms = toTerms(values);
      if (Object.values(terms).every((term) => term === "")) {
        forget();
        setNeedsTerm(true);
        return;
      }
      void run(terms, 1);
    },
    reset: () => {
      forget();
      setNeedsTerm(false);
    },
    retry: () => {
      if (last.current) void run(last.current.terms, last.current.page);
    },
    goToPage: (page: number) => {
      if (!last.current) return;
      paging.current = true;
      void run(last.current.terms, page);
    },
  };
}
