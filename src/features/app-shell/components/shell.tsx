import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import {
  RoleProvider,
  SessionEndRedirect,
  UnavailableState,
} from "@/features/auth/public";
import { getCurrentUser } from "@/features/auth/public-server";
import { navigationFor } from "@/lib/auth/app-routes";
import { Navigation } from "./navigation";
import { TopBar } from "./top-bar";

/** Sits inside the frame's `<Suspense>`, as reading the session can't be part of a static shell. */
export async function Shell({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  const current = await getCurrentUser(locale);
  if (current.kind === "no-session") return <SessionEndRedirect />;

  if (current.kind === "unavailable") {
    return (
      <>
        <TopBar />
        <main className="mx-auto max-w-xl p-4">
          <UnavailableState />
        </main>
      </>
    );
  }

  const { user } = current;
  const t = await getTranslations({ locale, namespace: "shell" });
  const items = navigationFor(user.role).map(({ path, labelKey }) => ({
    path,
    label: t(`nav.${labelKey}`),
  }));

  return (
    <RoleProvider role={user.role}>
      <TopBar user={user} />
      <div className="flex flex-col md:flex-row">
        <Navigation
          items={items}
          label={t("navigation")}
          menuLabel={t("menu")}
        />
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-4">
          {children}
        </main>
      </div>
    </RoleProvider>
  );
}
