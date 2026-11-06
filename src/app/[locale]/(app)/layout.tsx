import { setRequestLocale } from "next-intl/server";
import { type ReactNode, Suspense } from "react";
import { Shell } from "@/features/app-shell/components/shell";
import { ShellSkeleton } from "@/features/app-shell/components/shell-skeleton";
import { SessionWatcher } from "@/features/auth/components/session-watcher";

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <SessionWatcher />
      <Suspense fallback={<ShellSkeleton />}>
        <Shell locale={locale}>{children}</Shell>
      </Suspense>
    </>
  );
}
