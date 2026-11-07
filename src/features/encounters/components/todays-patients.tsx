"use client";

import { createContext, type ReactNode, useContext } from "react";
import { offeredForVisit, type TodaysPatients } from "../offered-history";
import type { RecordStatus } from "../types";
import { useTodaysPatients } from "../use-todays-patients";
import { HistoryLink } from "./history-link";

const TodaysPatientsContext = createContext<TodaysPatients>(null);

/** One read of today's list, for every row beneath it. */
export function TodaysPatientsProvider({ children }: { children: ReactNode }) {
  const patients = useTodaysPatients();
  return (
    <TodaysPatientsContext.Provider value={patients}>
      {children}
    </TodaysPatientsContext.Provider>
  );
}

/** Offered only where the API is expected to allow it, as a refused read writes a permanent entry (research R8). */
export function VisitHistoryLink({
  recordStatus,
  patientId,
  patientName,
}: {
  recordStatus: RecordStatus;
  patientId: number;
  patientName: string;
}) {
  const today = useContext(TodaysPatientsContext);

  return offeredForVisit(recordStatus, patientId, today) ? (
    <HistoryLink patientId={patientId} patientName={patientName} />
  ) : null;
}
