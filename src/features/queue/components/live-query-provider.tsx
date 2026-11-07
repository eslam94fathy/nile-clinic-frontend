"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * Only on the queue's pages, so that other pages don't carry the library (ADR 0013). The cache is in memory, and
 * sign-out and a `401` both load a whole new page, which clears it.
 */
export function LiveQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
