"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { readTodaysList } from "./api/encounters";
import { patientsOnTodaysList, type TodaysPatients } from "./offered-history";

/**
 * Who's on today's list, read once with the page. It isn't audited, and it only decides whether a history is offered,
 * so a failure simply offers nothing on that basis (research R8).
 */
export function useTodaysPatients(): TodaysPatients {
  const locale = useLocale();
  const [patients, setPatients] = useState<TodaysPatients>(null);
  const read = useRef(false);

  useEffect(() => {
    if (read.current) return;
    read.current = true;

    void readTodaysList(locale).then((result) => {
      if (result.ok) setPatients(patientsOnTodaysList(result.data.data));
    });
  }, [locale]);

  return patients;
}
