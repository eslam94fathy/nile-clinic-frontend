import { getTranslations } from "next-intl/server";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PreviewSection } from "./preview-section";

export async function FormSection({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "preview.form" });

  return (
    <PreviewSection heading={t("heading")}>
      <div className="flex max-w-xl flex-col gap-4">
        <FormError messages={[t("formError")]} />
        <FormField label={t("name")} hint={t("nameHint")} required>
          {(input) => <Input {...input} dir="auto" />}
        </FormField>
        <FormField label={t("phone")}>
          {(input) => <Input {...input} type="tel" dir="ltr" />}
        </FormField>
        <FormField label={t("method")}>
          {(input) => (
            <NativeSelect {...input} className="w-full">
              <NativeSelectOption value="cash">
                {t("methodCash")}
              </NativeSelectOption>
              <NativeSelectOption value="card">
                {t("methodCard")}
              </NativeSelectOption>
              <NativeSelectOption value="wallet">
                {t("methodWallet")}
              </NativeSelectOption>
            </NativeSelect>
          )}
        </FormField>
        <FormField label={t("note")} noMedicalDetails>
          {(input) => <Textarea {...input} dir="auto" />}
        </FormField>
        <FormField
          label={t("reason")}
          required
          noMedicalDetails
          error={t("reasonError")}
        >
          {(input) => <Input {...input} dir="auto" />}
        </FormField>
      </div>
    </PreviewSection>
  );
}
