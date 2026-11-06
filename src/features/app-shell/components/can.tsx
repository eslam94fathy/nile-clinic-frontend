"use client";

import type { ReactNode } from "react";
import { useRole } from "@/features/auth/public";
import { type Capability, can } from "@/lib/auth/permissions";

/** Shows its children only to a role with this capability. This is UX: the API decides, and its `403` wins. */
export function Can({
  capability,
  children,
}: {
  capability: Capability;
  children: ReactNode;
}) {
  const role = useRole();
  return role && can(role, capability) ? children : null;
}
