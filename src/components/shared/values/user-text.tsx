import type { ReactNode } from "react";

/** For stored text such as names. It takes its direction from its own content, and is never translated. */
export function UserText({ children }: { children: ReactNode }) {
  // Stored text can be one long word, and must wrap rather than widen the page.
  return (
    <bdi dir="auto" className="[overflow-wrap:anywhere]">
      {children}
    </bdi>
  );
}
