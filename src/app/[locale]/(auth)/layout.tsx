import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { PublicHeader } from "@/components/shared/public-header";

export default async function AuthLayout({
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
      <PublicHeader />
      {children}
    </>
  );
}
