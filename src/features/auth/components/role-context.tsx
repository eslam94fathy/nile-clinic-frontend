"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, use, useEffect } from "react";
import type { Role } from "@/lib/auth/permissions";

const RoleContext = createContext<Role | null>(null);

export function RoleProvider({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  return <RoleContext value={role}>{children}</RoleContext>;
}

export function useRole(): Role | null {
  return use(RoleContext);
}

/**
 * Layouts don't re-render on navigation, but pages do. So when a page finds that the role has changed, this
 * refreshes the shell, and its navigation follows.
 */
export function RoleSync({ role }: { role: Role }) {
  const shellRole = useRole();
  const router = useRouter();

  useEffect(() => {
    if (shellRole && shellRole !== role) router.refresh();
  }, [shellRole, role, router]);

  return null;
}
