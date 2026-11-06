import "server-only";
import { cache } from "react";
import { z } from "zod";
import { itemSchema } from "@/lib/api/pagination";
import { readResource, toQuery } from "@/lib/api/read-resource";
import { scheduleSchema, slotSchema, timeOffSchema } from "../schemas/schedule";
import type { DoctorRef } from "../types";

// Each is shared within one render, by its section and the readiness summary.
export const readSchedule = cache((locale: string, doctor: DoctorRef) =>
  readResource(
    `doctors/${doctor}/schedule`,
    locale,
    itemSchema(scheduleSchema),
  ),
);

export const readSlots = cache(
  (locale: string, doctor: DoctorRef, from: string, to: string) =>
    readResource(
      `doctors/${doctor}/slots${toQuery({ from, to })}`,
      locale,
      z.object({ data: z.array(slotSchema) }),
    ),
);

export const readTimeOff = cache(
  (locale: string, doctor: DoctorRef, from: string, to: string) =>
    readResource(
      `doctors/${doctor}/time-off${toQuery({ from, to })}`,
      locale,
      z.object({ data: z.array(timeOffSchema) }),
    ),
);
