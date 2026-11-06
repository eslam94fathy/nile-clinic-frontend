"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError } from "@/components/shared/form/form-error";
import { FormField } from "@/components/shared/form/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { type StaffMember, useHydrated } from "@/features/auth/public";
import { useFormSubmit } from "@/lib/api/use-form-submit";
import { useRouter } from "@/lib/i18n/navigation";
import { updateStaffMember } from "../api/staff";
import {
  STAFF_ROLES,
  type StaffEditValues,
  staffEditSchema,
} from "../schemas/staff";
import { useStaffFormText } from "./use-staff-form-text";

const FIELDS = ["name", "email", "role"] as const;

export function StaffEditForm({
  member,
  isSelf,
}: {
  member: StaffMember;
  isSelf: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("staff");
  const roles = useTranslations("roles");
  const shared = useTranslations("shared.form");
  const hydrated = useHydrated();
  const router = useRouter();
  const text = useStaffFormText();
  const schema = useMemo(() => staffEditSchema(text), [text]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<StaffEditValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: member.name,
      email: member.email,
      role: member.role,
    },
  });
  const { working, formErrors, setFormErrors, submit } =
    useFormSubmit<StaffEditValues>({
      fields: FIELDS,
      setError,
      generalFailure: shared("generalFailure"),
    });
  const [awaitingConfirmation, setAwaitingConfirmation] =
    useState<Partial<StaffEditValues> | null>(null);

  async function send(changes: Partial<StaffEditValues>) {
    await submit(
      () => updateStaffMember(member.id, changes, locale),
      () => {
        toast.success(t("saved"));
        router.refresh();
      },
    );
    setAwaitingConfirmation(null);
  }

  const leavesDoctor = (changes: Partial<StaffEditValues>) =>
    changes.role !== undefined && member.role === "doctor";
  const demotesSelf = (changes: Partial<StaffEditValues>) =>
    changes.role !== undefined && isSelf && member.role === "administrator";

  async function onSubmit(values: StaffEditValues) {
    const changes: Partial<StaffEditValues> = {
      ...(values.name === member.name ? {} : { name: values.name }),
      ...(values.email === member.email ? {} : { email: values.email }),
      ...(values.role === member.role ? {} : { role: values.role }),
    };
    if (Object.keys(changes).length === 0) {
      setFormErrors([shared("nothingToSave")]);
      return;
    }
    if (leavesDoctor(changes) || demotesSelf(changes)) {
      setFormErrors([]);
      setAwaitingConfirmation(changes);
      return;
    }
    await send(changes);
  }

  const self =
    awaitingConfirmation !== null && demotesSelf(awaitingConfirmation);

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="flex max-w-md flex-col gap-4"
    >
      <FormError messages={formErrors} />
      <FormField label={t("name")} error={errors.name?.message} required>
        {(input) => (
          // `defaultValue`, so that the current value is there before hydration.
          <Input
            {...input}
            {...register("name")}
            defaultValue={member.name}
            dir="auto"
          />
        )}
      </FormField>
      <FormField label={t("email")} error={errors.email?.message} required>
        {(input) => (
          <Input
            {...input}
            {...register("email")}
            defaultValue={member.email}
            type="email"
            dir="ltr"
          />
        )}
      </FormField>
      <FormField label={t("role")} error={errors.role?.message} required>
        {(input) => (
          <NativeSelect
            {...input}
            {...register("role")}
            defaultValue={member.role}
            className="w-full"
          >
            {STAFF_ROLES.map((role) => (
              <NativeSelectOption key={role} value={role}>
                {roles(role)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <div>
        {/* The dialog opens only through `onSubmit`. Being its trigger, the button gets focus back after it. */}
        <ConfirmDialog
          trigger={
            <Button type="submit" disabled={!hydrated || working}>
              {working ? t("saving") : t("save")}
            </Button>
          }
          title={self ? t("selfDemoteTitle") : t("leavesDoctorTitle")}
          description={
            self ? t("selfDemoteDescription") : t("leavesDoctorDescription")
          }
          confirmLabel={t("confirmRole")}
          destructive
          pending={working}
          open={awaitingConfirmation !== null}
          onOpenChange={(next) => {
            if (!next) setAwaitingConfirmation(null);
          }}
          onConfirm={() => {
            if (awaitingConfirmation) void send(awaitingConfirmation);
          }}
        />
      </div>
    </form>
  );
}
