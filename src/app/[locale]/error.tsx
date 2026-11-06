"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ retry }: { retry: () => void }) {
  const t = useTranslations("error");

  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 p-4">
      <h1 className="text-3xl font-semibold">{t("heading")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button type="button" variant="outline" onClick={() => retry()}>
        {t("retry")}
      </Button>
    </main>
  );
}
