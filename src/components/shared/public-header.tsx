import { useLocale, useTranslations } from "next-intl";
import { getDirection } from "@/lib/i18n/direction";
import { Link } from "@/lib/i18n/navigation";
import { LanguageSwitch } from "./language-switch";
import { Logo } from "./logo";
import { ThemeSwitch } from "./theme/theme-switch";

/** For pages outside the signed-in frame. It can't go in the root layout: see research R8 in Phase 3. */
export function PublicHeader() {
  const t = useTranslations();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 p-4">
      {/* No prefetch: the home page leads to the sign-in page, which checks the backend's health. */}
      <Link href="/" prefetch={false} className="rounded-sm">
        <Logo
          name={t("brand.name")}
          tagline={t("brand.tagline")}
          direction={getDirection(useLocale())}
        />
      </Link>
      <div className="flex items-center gap-4">
        <ThemeSwitch />
        <nav aria-label={t("language.label")}>
          <LanguageSwitch label={t("language.switch")} />
        </nav>
      </div>
    </header>
  );
}
