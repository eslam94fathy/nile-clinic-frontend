import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <h1 className="text-3xl font-semibold">{t("heading")}</h1>
      <p className="text-neutral-700">{t("description")}</p>
      <Link href="/" className="underline">
        {t("home")}
      </Link>
    </main>
  );
}
