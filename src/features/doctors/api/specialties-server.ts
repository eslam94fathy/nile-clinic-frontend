import "server-only";
import { z } from "zod";
import { readResource, toQuery } from "@/lib/api/read-resource";
import { specialtySchema } from "../schemas/specialty";

const listSchema = z.object({ data: z.array(specialtySchema) });

export function readSpecialties(locale: string, onlyActive = false) {
  return readResource(
    `specialties${toQuery({ is_active: onlyActive ? 1 : undefined })}`,
    locale,
    listSchema,
  );
}
