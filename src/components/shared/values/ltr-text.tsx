import type { ReactNode } from "react";

/** For phone numbers, IDs, and codes, which read left to right even inside Arabic text. */
export function LtrText({
  children,
  breakable,
}: {
  children: ReactNode;
  /** For an email address, which is long and safe to wrap. */
  breakable?: boolean;
}) {
  // Otherwise never broken across lines: a phone number split in two is easy to misread.
  return (
    <bdi
      dir="ltr"
      className={breakable ? "[overflow-wrap:anywhere]" : "whitespace-nowrap"}
    >
      {children}
    </bdi>
  );
}
