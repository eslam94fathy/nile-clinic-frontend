import { z } from "zod";
import type { ApiResult } from "@/lib/api/api-error";
import { browserApi } from "@/lib/api/browser-api";
import { checkResult, toQuery } from "@/lib/api/check-result";
import { slotSchema } from "../schemas/schedule";
import type { Slot } from "../types";

const listSchema = z.object({ data: z.array(slotSchema) });

/** Free times to choose from on a screen with no navigation. Not audited. The API decides all of it. */
export async function readFreeTimes(
  doctorId: number,
  from: string,
  to: string,
  locale: string,
): Promise<ApiResult<Slot[]>> {
  const body = checkResult(
    await browserApi(`doctors/${doctorId}/slots${toQuery({ from, to })}`, {
      locale,
    }),
    listSchema,
  );
  return body.ok ? { ...body, data: body.data.data } : body;
}
