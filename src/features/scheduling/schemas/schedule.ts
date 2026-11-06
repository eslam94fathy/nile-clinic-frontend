import { z } from "zod";
import { toWesternDigits } from "@/lib/format/digits";
import { DAYS, type Schedule, type Slot, type TimeOff } from "../types";

const daySchema = z.enum(DAYS);

export const scheduleSchema = z.object({
  doctor_id: z.number(),
  appointment_minutes: z.number().nullable(),
  days: z.array(
    z.object({
      day: daySchema,
      periods: z.array(z.object({ start: z.string(), end: z.string() })),
    }),
  ),
  updated_at: z.string().nullable(),
}) satisfies z.ZodType<Schedule>;

export const slotSchema = z.object({
  date: z.string(),
  start: z.string(),
  end: z.string(),
}) satisfies z.ZodType<Slot>;

export const timeOffSchema = z.object({
  id: z.number(),
  doctor_id: z.number(),
  start_date: z.string(),
  end_date: z.string(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  reason: z.string().nullable(),
  created_at: z.string(),
}) satisfies z.ZodType<TimeOff>;

// The contract's patterns: a 5-minute boundary, and `24:00` only as an end.
export const START_TIME = /^([01][0-9]|2[0-3]):[0-5][05]$/;
export const END_TIME = /^(([01][0-9]|2[0-3]):[0-5][05]|24:00)$/;

const typedTime = z
  .string()
  .transform((value) => toWesternDigits(value).trim());

function time(pattern: RegExp, message: string) {
  return typedTime.refine((value) => pattern.test(value), { error: message });
}

export function scheduleFormSchema(text: {
  minutesRule: string;
  timeFormat: string;
}) {
  return z.object({
    appointment_minutes: z
      .string()
      .transform((value) => toWesternDigits(value).trim())
      .refine(
        (value) => {
          if (!/^\d+$/.test(value)) return false;
          const minutes = Number(value);
          return minutes >= 5 && minutes <= 240 && minutes % 5 === 0;
        },
        { error: text.minutesRule },
      )
      .transform(Number),
    periods: z.array(
      z.object({
        day: daySchema,
        start: time(START_TIME, text.timeFormat),
        end: time(END_TIME, text.timeFormat),
      }),
    ),
  });
}

export type ScheduleFormOutput = z.output<
  ReturnType<typeof scheduleFormSchema>
>;

export function timeOffFormSchema(text: {
  dateRequired: string;
  timeFormat: string;
  reasonTooLong: string;
}) {
  return z
    .object({
      kind: z.enum(["whole", "part"]),
      start_date: z.string().min(1, text.dateRequired),
      end_date: z.string(),
      start_time: typedTime,
      end_time: typedTime,
      reason: z.string().trim().max(255, text.reasonTooLong),
    })
    .superRefine((values, context) => {
      if (values.kind === "whole") {
        if (!values.end_date) {
          context.addIssue({
            code: "custom",
            path: ["end_date"],
            message: text.dateRequired,
          });
        }
        return;
      }
      if (!START_TIME.test(values.start_time)) {
        context.addIssue({
          code: "custom",
          path: ["start_time"],
          message: text.timeFormat,
        });
      }
      if (!END_TIME.test(values.end_time)) {
        context.addIssue({
          code: "custom",
          path: ["end_time"],
          message: text.timeFormat,
        });
      }
    });
}

export type TimeOffFormOutput = z.output<ReturnType<typeof timeOffFormSchema>>;

export type TimeOffBody = {
  start_date: string;
  end_date: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
};

/** Whole days send no times. Part of a day has the same date at both ends. A blank reason is left out. */
export function toTimeOffBody(values: TimeOffFormOutput): TimeOffBody {
  const reason = values.reason ? { reason: values.reason } : {};
  return values.kind === "whole"
    ? { start_date: values.start_date, end_date: values.end_date, ...reason }
    : {
        start_date: values.start_date,
        end_date: values.start_date,
        start_time: values.start_time,
        end_time: values.end_time,
        ...reason,
      };
}
