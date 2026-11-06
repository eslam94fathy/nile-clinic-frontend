"use client";

import { useEffect } from "react";
import { endSession } from "@/lib/auth/session-end";

/** Rendered by the server when it finds no session, because it can't clear the cookie itself. */
export function SessionEndRedirect() {
  useEffect(() => endSession(), []);
  return null;
}
