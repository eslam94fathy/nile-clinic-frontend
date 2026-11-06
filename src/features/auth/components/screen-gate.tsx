import type { ReactNode } from "react";
import { ForbiddenState } from "@/components/shared/states/forbidden-state";
import {
  type AppPath,
  canOpen,
  findRoute,
  needsDoctorProfile,
} from "@/lib/auth/app-routes";
import { getCurrentUser } from "../api/current-user";
import { getDoctorProfileStatus } from "../api/doctor-profile";
import { NoProfileState } from "./no-profile-state";
import { RoleSync } from "./role-context";
import { SessionEndRedirect } from "./session-end-redirect";
import { UnavailableState } from "./unavailable-state";

/**
 * Wraps all of a page's content, inside `<Suspense>`. This belongs in pages, as pages re-render on
 * navigation and layouts don't. Children aren't rendered or sent unless the person may see them. This
 * decides what's shown, and the API remains the boundary.
 */
export async function ScreenGate({
  locale,
  path,
  children,
}: {
  locale: string;
  path: AppPath;
  children: ReactNode;
}) {
  const current = await getCurrentUser(locale);
  if (current.kind === "no-session") return <SessionEndRedirect />;
  if (current.kind === "unavailable") return <UnavailableState />;

  const { role } = current.user;
  const route = findRoute(path);
  if (!route || !canOpen(role, route)) {
    return (
      <>
        <RoleSync role={role} />
        <ForbiddenState />
      </>
    );
  }

  if (role === "doctor" && needsDoctorProfile(path)) {
    const profile = await getDoctorProfileStatus(locale);
    if (profile === "no-session") return <SessionEndRedirect />;
    if (profile === "unknown") return <UnavailableState />;
    if (profile !== "present") {
      return (
        <>
          <RoleSync role={role} />
          {profile === "missing" ? <NoProfileState /> : <ForbiddenState />}
        </>
      );
    }
  }

  return (
    <>
      <RoleSync role={role} />
      {children}
    </>
  );
}
