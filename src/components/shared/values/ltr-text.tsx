import type { ReactNode } from "react";

/** For phone numbers, IDs, and codes, which read left to right even inside Arabic text. */
export function LtrText({ children }: { children: ReactNode }) {
  // Never broken across lines: a phone number split in two is easy to misread.
  return (
    <bdi dir="ltr" className="whitespace-nowrap">
      {children}
    </bdi>
  );
}
