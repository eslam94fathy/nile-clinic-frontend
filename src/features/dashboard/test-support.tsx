// Shared set-up for the dashboard's component tests. Synthetic data only: none of it describes a real clinic.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { RoleProvider } from "@/features/auth/public";
import type { Role } from "@/lib/auth/permissions";
import { renderWithIntl } from "@/test-support/render-with-intl";

export const TODAY = "2026-11-11";
export const TIME_ZONE = "Africa/Cairo";

export const ok = <Data,>(data: Data) => ({
  ok: true as const,
  status: 200,
  data,
});
export const refused = (status: number, message?: string) => ({
  ok: false as const,
  error: { status, fieldErrors: {}, ...(message ? { message } : {}) },
});

export const anAppointmentRow = (
  id: number,
  changes: { start?: string } = {},
) => ({
  id,
  date: TODAY,
  start: changes.start ?? "09:00",
  end: "09:20",
  patient: { full_name: `Synthetic Patient ${id}` },
  doctor: { name: "Synthetic Doctor", title: "Consultant" },
});

export function renderDashboard(
  ui: ReactNode,
  role: Role,
  locale: "en" | "ar" = "en",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 1 } },
  });
  return renderWithIntl(
    <RoleProvider role={role}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </RoleProvider>,
    locale,
  );
}
