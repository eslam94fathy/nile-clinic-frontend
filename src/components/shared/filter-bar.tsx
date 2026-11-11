"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { FormField } from "./form/form-field";

type FilterBase = {
  name: string;
  label: string;
  hint?: string;
  /**
   * Required, with no default, so a screen can't put patient details in the page's address by
   * forgetting a flag (constitution II).
   */
  inAddress: boolean;
  /** Shown when the address has no value, and restored on reset. For a filter that always has a value. */
  defaultValue?: string;
};

export type FilterDefinition = FilterBase &
  ({ type: "text" | "date" } | { type: "select"; options: FilterOption[] });

/** `group` puts consecutive options with the same label into one `optgroup`, for a long list such as the audit's actions. */
export type FilterOption = { value: string; label: string; group?: string };

type OptionRun = { group: string | undefined; options: FilterOption[] };

function runsOf(options: FilterOption[]): OptionRun[] {
  const runs: OptionRun[] = [];
  for (const option of options) {
    const last = runs.at(-1);
    if (last && last.group !== undefined && last.group === option.group) {
      last.options.push(option);
    } else {
      runs.push({ group: option.group, options: [option] });
    }
  }
  return runs;
}

const renderOptions = (options: FilterOption[]) =>
  options.map((option) => (
    <NativeSelectOption key={option.value} value={option.value}>
      {option.label}
    </NativeSelectOption>
  ));

export type FilterValues = Record<string, string>;

const FILTER_ATTRIBUTE = "data-filter";

// The fields are uncontrolled, so what someone types before JavaScript has loaded isn't lost.
function fieldsIn(form: HTMLFormElement | null) {
  const fields = new Map<string, HTMLInputElement | HTMLSelectElement>();
  form?.querySelectorAll(`[${FILTER_ATTRIBUTE}]`).forEach((field) => {
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLSelectElement
    ) {
      fields.set(field.getAttribute(FILTER_ATTRIBUTE) ?? "", field);
    }
  });
  return fields;
}

/** Each filter's value, trimmed, as `onApply` and `onChange` give it. */
function valuesIn(form: HTMLFormElement, filters: FilterDefinition[]) {
  const fields = fieldsIn(form);
  return Object.fromEntries(
    filters.map((filter) => [
      filter.name,
      (fields.get(filter.name)?.value ?? "").trim(),
    ]),
  ) satisfies FilterValues;
}

export function FilterBar({
  filters,
  onApply,
  onReset,
  onChange,
  applyBlocked = false,
  errors,
  applyLabel,
  resetLabel,
}: {
  filters: FilterDefinition[];
  onApply?: (values: FilterValues) => void;
  /** Called instead of `onApply` on reset, for a screen that must tell a reset from an empty search. */
  onReset?: () => void;
  /** Every value, as `onApply` would give it, each time the person changes a field. Nothing is applied. */
  onChange?: (values: FilterValues) => void;
  /**
   * The apply button says it's unavailable, and pressing it or Enter does nothing, while the screen can't take a new
   * search. Not `disabled`, so the button keeps its focus.
   */
  applyBlocked?: boolean;
  /** Each filter's error, by name, shown as sent. */
  errors?: Partial<Record<string, string>>;
  applyLabel?: string;
  resetLabel?: string;
}) {
  const t = useTranslations("shared.filters");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);

  const addressKey = JSON.stringify(
    filters
      .filter((filter) => filter.inAddress)
      .map((filter) => [searchParams.get(filter.name), filter.defaultValue]),
  );
  const syncedKey = useRef(addressKey);

  // Follows the back button and links. Writing to the fields rather than remounting the form keeps
  // keyboard focus where it is, and leaves unrelated changes, such as the page number, alone.
  useEffect(() => {
    if (syncedKey.current === addressKey) return;
    syncedKey.current = addressKey;

    const fields = fieldsIn(form.current);
    for (const filter of filters) {
      const field = fields.get(filter.name);
      if (field && filter.inAddress) {
        field.value =
          searchParams.get(filter.name) ?? filter.defaultValue ?? "";
      }
    }
  }, [addressKey, filters, searchParams]);

  function navigate(applied: FilterValues) {
    // Nothing here belongs in the address, so any page number there belongs to something else on the screen.
    if (!filters.some((filter) => filter.inAddress)) return;

    const current = searchParams.toString();
    const next = new URLSearchParams(current);
    // A different filter means a different list, so its page number no longer applies.
    next.delete("page");
    for (const filter of filters) {
      if (!filter.inAddress) continue;
      const value = applied[filter.name];
      if (value) next.set(filter.name, value);
      else next.delete(filter.name);
    }

    // The same address again would add a useless history entry, and could repeat an audited read.
    const query = next.toString();
    if (query === current) return;
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (applyBlocked) return;
    const applied = valuesIn(event.currentTarget, filters);
    navigate(applied);
    onApply?.(applied);
  }

  function reset() {
    const fields = fieldsIn(form.current);
    for (const filter of filters) {
      const field = fields.get(filter.name);
      if (field) field.value = filter.defaultValue ?? "";
    }
    navigate({});
    if (onReset) onReset();
    else onApply?.({});
  }

  const fieldProps = (filter: FilterDefinition) => ({
    [FILTER_ATTRIBUTE]: filter.name,
    // A private filter has no `name`, so submitting before JavaScript has loaded can't put it in the
    // address: the browser only sends named fields.
    ...(filter.inAddress ? { name: filter.name } : { autoComplete: "off" }),
    defaultValue: filter.inAddress
      ? (searchParams.get(filter.name) ?? filter.defaultValue ?? "")
      : "",
  });

  return (
    <form
      ref={form}
      aria-label={t("label")}
      onSubmit={apply}
      onChange={
        onChange
          ? (event) => onChange(valuesIn(event.currentTarget, filters))
          : undefined
      }
      className="flex flex-wrap items-start gap-3"
    >
      {filters.map((filter) => (
        <div key={filter.name} className="min-w-44 flex-1">
          <FormField
            label={filter.label}
            hint={filter.hint}
            error={errors?.[filter.name]}
          >
            {(input) =>
              filter.type === "select" ? (
                <NativeSelect
                  {...input}
                  {...fieldProps(filter)}
                  className="w-full"
                >
                  {runsOf(filter.options).map((run, index) =>
                    run.group === undefined ? (
                      renderOptions(run.options)
                    ) : (
                      <NativeSelectOptGroup
                        key={`${run.group}-${String(index)}`}
                        label={run.group}
                      >
                        {renderOptions(run.options)}
                      </NativeSelectOptGroup>
                    ),
                  )}
                </NativeSelect>
              ) : (
                <Input {...input} {...fieldProps(filter)} type={filter.type} />
              )
            }
          </FormField>
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        {/* Takes a label's height, so the buttons line up with the fields whether or not one has a hint. */}
        <span aria-hidden="true" className="invisible text-sm leading-none">
          {applyLabel ?? t("apply")}
        </span>
        <div className="flex gap-2">
          <Button type="submit" aria-disabled={applyBlocked || undefined}>
            {applyLabel ?? t("apply")}
          </Button>
          <Button type="button" variant="outline" onClick={reset}>
            {resetLabel ?? t("reset")}
          </Button>
        </div>
      </div>
    </form>
  );
}
