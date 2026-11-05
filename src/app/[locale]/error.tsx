"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({ retry }: { retry: () => void }) {
  const t = useTranslations("error");

  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 p-4">
      <h1 className="text-3xl font-semibold">{t("heading")}</h1>
      <p className="text-neutral-700">{t("description")}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded border border-neutral-500 px-3 py-1"
      >
        {t("retry")}
      </button>
    </main>
  );
}
