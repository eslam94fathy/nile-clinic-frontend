"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { PAYMENT_METHODS } from "../types";

/**
 * Cash, card, or wallet, as one click each. None is chosen at first, so the method recorded is always one somebody
 * picked (research R7).
 */
export function MethodChoice({
  legend,
  error,
  disabled,
  registration,
}: {
  legend: string;
  error?: string | undefined;
  disabled?: boolean;
  registration: UseFormRegisterReturn;
}) {
  const t = useTranslations("shared.paymentMethod");
  const errorId = useId();

  return (
    <fieldset
      className="flex flex-col gap-2"
      {...(error ? { "aria-describedby": errorId } : {})}
    >
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {PAYMENT_METHODS.map((method) => (
          <label
            key={method}
            className="cursor-pointer rounded-lg border px-3 py-1.5 has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="radio"
              value={method}
              className="sr-only"
              disabled={disabled}
              {...(error ? { "aria-invalid": true } : {})}
              {...registration}
            />
            {t(method)}
          </label>
        ))}
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-[0.8125rem] font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
