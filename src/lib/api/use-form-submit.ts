"use client";

import { useRef, useState } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { useRouter } from "@/lib/i18n/navigation";
import type { ApiResult } from "./api-error";
import { mapFieldErrors } from "./map-field-errors";

/**
 * Every form's change: one request at a time, progress, and errors on their fields or at form level. A
 * `403` or `404` also refreshes the page, so that the gate or the page itself can re-decide what to show.
 */
export function useFormSubmit<Values extends FieldValues>({
  fields,
  setError,
  generalFailure,
}: {
  fields: readonly Path<Values>[];
  setError: UseFormSetError<Values>;
  generalFailure: string;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [working, setWorking] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  async function submit<Data>(
    call: () => Promise<ApiResult<Data>>,
    onSuccess: (data: Data) => void,
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setFormErrors([]);

    const result = await call();
    inFlight.current = false;
    setWorking(false);

    if (result.ok) {
      onSuccess(result.data);
      return;
    }

    setFormErrors(
      mapFieldErrors(result.error, fields, setError, generalFailure),
    );
    if (result.error.status === 403 || result.error.status === 404) {
      router.refresh();
    }
  }

  return { working, formErrors, setFormErrors, submit };
}
