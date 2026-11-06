import { useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";
import { Label } from "@/components/ui/label";

export type FormFieldInputProps = {
  id: string;
  required?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

export function FormField({
  label,
  hint,
  error,
  required,
  noMedicalDetails,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  /** Shown as sent when it comes from the backend. */
  error?: string;
  required?: boolean;
  /** Adds the standard hint for fields that must not hold medical details. */
  noMedicalDetails?: boolean;
  children: (input: FormFieldInputProps) => ReactNode;
}) {
  const t = useTranslations("shared.form");
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const medicalId = noMedicalDetails ? `${id}-medical` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, medicalId, errorId].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="font-normal text-muted-foreground">
            {t("required")}
          </span>
        ) : null}
      </Label>
      {children({
        id,
        ...(required ? { required } : {}),
        ...(error ? { "aria-invalid": true as const } : {}),
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      })}
      {hint ? (
        <p id={hintId} className="text-[0.8125rem] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {noMedicalDetails ? (
        <p id={medicalId} className="text-[0.8125rem] text-muted-foreground">
          {t("noMedicalDetails")}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-[0.8125rem] font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
