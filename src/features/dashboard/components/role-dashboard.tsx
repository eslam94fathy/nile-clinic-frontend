"use client";

import type { Role } from "@/lib/auth/permissions";
import { AdministratorDashboard } from "./administrator-dashboard";
import { DoctorDashboard } from "./doctor-dashboard";
import { ReceptionistDashboard } from "./receptionist-dashboard";

/**
 * The signed-in role's dashboard. The role comes from the server's answer for this render, so no panel reads under
 * another role's. If the role changes while the page is open, each panel's next read shows the API's refusal, and the
 * page changes dashboards on reload (spec, edge cases).
 */
export function RoleDashboard({
  role,
  timeZone,
  today,
}: {
  role: Role;
  timeZone: string;
  /** The clinic's date as the server rendered the page, so the browser's first render matches it. */
  today: string;
}) {
  switch (role) {
    case "administrator":
      return <AdministratorDashboard timeZone={timeZone} today={today} />;
    case "receptionist":
      return <ReceptionistDashboard timeZone={timeZone} />;
    case "doctor":
      return <DoctorDashboard timeZone={timeZone} />;
  }
}
