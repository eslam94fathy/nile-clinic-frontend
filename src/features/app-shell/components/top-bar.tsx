import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitch } from "@/components/shared/language-switch";
import { Logo } from "@/components/shared/logo";
import { ThemeSwitch } from "@/components/shared/theme/theme-switch";
import { UserText } from "@/components/shared/values/user-text";
import { SignOutButton, type StaffMember } from "@/features/auth/public";
import { getDirection } from "@/lib/i18n/direction";
import { Link } from "@/lib/i18n/navigation";

export function TopBar({ user }: { user?: StaffMember }) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b p-4">
      <Link href="/dashboard" className="rounded-sm">
        <Logo
          name={t("brand.name")}
          tagline={t("brand.tagline")}
          direction={getDirection(locale)}
        />
      </Link>
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        {user ? (
          // Shortened if it's very long, with the whole name in `title` and for screen readers.
          <p
            className="max-w-56 truncate text-sm text-muted-foreground"
            title={user.name}
          >
            <UserText>{user.name}</UserText>
          </p>
        ) : null}
        <ThemeSwitch />
        <nav aria-label={t("language.label")}>
          <LanguageSwitch label={t("language.switch")} />
        </nav>
        {user ? (
          <>
            <Link
              href="/account"
              className="inline-flex min-h-6 items-center text-primary underline underline-offset-4"
            >
              {t("shell.account")}
            </Link>
            <SignOutButton
              label={t("auth.signOut.label")}
              workingLabel={t("auth.signOut.working")}
              failureLabel={t("auth.signOut.failure")}
            />
          </>
        ) : null}
      </div>
    </header>
  );
}
