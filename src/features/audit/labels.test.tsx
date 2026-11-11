import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { messagesByLocale } from "@/test-support/render-with-intl";
import { type AuditLabels, useAuditLabels } from "./labels";

afterEach(cleanup);

function Probe({ show }: { show: (labels: AuditLabels) => string | null }) {
  return <p>{show(useAuditLabels()) ?? "(none)"}</p>;
}

function shown(
  show: (labels: AuditLabels) => string | null,
  locale: "en" | "ar" = "en",
) {
  const { unmount } = render(
    <NextIntlClientProvider
      locale={locale}
      messages={messagesByLocale[locale]}
      onError={() => {
        throw new Error("A missing message was looked up");
      }}
    >
      <Probe show={show} />
    </NextIntlClientProvider>,
  );
  const text = screen.getByRole("paragraph").textContent;
  unmount();
  return text;
}

const en = messagesByLocale.en;

describe("useAuditLabels", () => {
  it("translates an action, nested by its dots", () => {
    expect(shown((l) => l.action("auth.sign_in"))).toBe(
      en.audit.actions.auth.sign_in,
    );
    expect(shown((l) => l.action("time_off.added"))).toBe(
      en.audit.actions.time_off.added,
    );
  });

  it("translates outcomes, record types, roles, and known fields", () => {
    expect(shown((l) => l.outcome("refused"))).toBe(en.audit.outcomes.refused);
    expect(shown((l) => l.subject("encounter"))).toBe(
      en.audit.subjects.encounter,
    );
    expect(shown((l) => l.role("doctor"))).toBe(en.roles.doctor);
    expect(shown((l) => l.field("discount_reason"))).toBe(
      en.audit.fields.discount_reason,
    );
  });

  it("shows what it doesn't know as sent, without looking up a missing message", () => {
    expect(shown((l) => l.field("loyalty_points"))).toBe("loyalty_points");
    expect(shown((l) => l.field("a.b"))).toBe("a.b");
    expect(shown((l) => l.action("visit.paused"))).toBe("visit.paused");
    expect(shown((l) => l.role("owner"))).toBe("owner");
  });

  it("speaks Arabic", () => {
    expect(shown((l) => l.action("discount.set"), "ar")).toBe(
      messagesByLocale.ar.audit.actions.discount.set,
    );
  });
});
