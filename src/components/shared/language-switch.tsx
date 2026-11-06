"use client";

import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Link, usePathname } from "@/lib/i18n/navigation";

function SwitchLink({ label, query = "" }: { label: string; query?: string }) {
  const pathname = usePathname();
  const target = useLocale() === "ar" ? "en" : "ar";

  // next-intl's Link saves the choice in the language cookie when clicked, and doesn't prefetch.
  return (
    <Link
      href={query ? `${pathname}?${query}` : pathname}
      locale={target}
      lang={target}
      className="inline-flex min-h-6 items-center text-primary underline underline-offset-4"
    >
      {label}
    </Link>
  );
}

function SwitchLinkWithQuery({ label }: { label: string }) {
  return <SwitchLink label={label} query={useSearchParams().toString()} />;
}

export function LanguageSwitch({ label }: { label: string }) {
  return (
    <Suspense fallback={<SwitchLink label={label} />}>
      <SwitchLinkWithQuery label={label} />
    </Suspense>
  );
}
