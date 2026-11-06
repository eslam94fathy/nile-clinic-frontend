"use client";

import { useEffect } from "react";
import type {
  FieldPath,
  FieldValues,
  UseFormResetField,
} from "react-hook-form";

/**
 * Wipes these fields when the person leaves the form. A visited page stays mounted but hidden until sign-out,
 * and React runs an effect's cleanup when it's hidden, so without this a password typed and never submitted
 * would stay in the page, and be back when it's reopened (FR-011). `names` must be a constant.
 */
export function useClearOnLeave<Values extends FieldValues>(
  resetField: UseFormResetField<Values>,
  names: readonly FieldPath<Values>[],
) {
  useEffect(
    () => () => {
      for (const name of names) resetField(name);
    },
    [resetField, names],
  );
}
