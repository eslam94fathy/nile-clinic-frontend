import "server-only";
import { cache } from "react";
import { itemSchema, pageSchema } from "@/lib/api/pagination";
import { readResource, toQuery } from "@/lib/api/read-resource";
import { doctorFeeSchema } from "../schemas/fee";

export function readFees(locale: string, page: string | undefined) {
  return readResource(
    `fees${toQuery({ page })}`,
    locale,
    pageSchema(doctorFeeSchema),
  );
}

/** Shared within one render, by the fee section and the readiness summary. */
export const readFee = cache((locale: string, doctorId: number) =>
  readResource(`doctors/${doctorId}/fee`, locale, itemSchema(doctorFeeSchema)),
);
