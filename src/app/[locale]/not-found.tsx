import { useTranslations } from "next-intl";
import { PublicHeader } from "@/components/shared/public-header";
import { Link } from "@/lib/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex max-w-xl flex-col gap-4 p-4">
        <h1 className="text-3xl font-semibold">{t("heading")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
        <Link href="/" className="text-primary underline underline-offset-4">
          {t("home")}
        </Link>
      </main>
    </>
  );
}
