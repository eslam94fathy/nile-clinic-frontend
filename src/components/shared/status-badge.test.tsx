import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { StatusBadge } from "./status-badge";
import { type StatusKind, statusTones } from "./status-mapping";

afterEach(cleanup);

// FR-018, written out again so that a change to the mapping has to change the spec's table too.
const expected: [StatusKind, string, string][] = [
  ["appointment", "scheduled", "neutral"],
  ["appointment", "checked_in", "active"],
  ["appointment", "completed", "success"],
  ["appointment", "no_show", "warning"],
  ["appointment", "cancelled", "muted"],
  ["queue", "waiting", "neutral"],
  ["queue", "with_doctor", "active"],
  ["queue", "seen", "success"],
  ["queue", "left", "warning"],
  ["charge", "none", "neutral"],
  ["charge", "partially_paid", "active"],
  ["charge", "paid", "success"],
  ["charge", "unpaid", "warning"],
  ["charge", "cancelled", "muted"],
  ["record", "none", "neutral"],
  ["record", "draft", "active"],
  ["record", "finalized", "success"],
  ["activity", "active", "success"],
  ["activity", "deactivated", "muted"],
  ["activity", "inactive", "muted"],
  ["outcome", "succeeded", "success"],
  ["outcome", "refused", "warning"],
];

// Some cases pass a runtime string, which is exactly what the type can't check.
function Badge({ kind, value }: { kind: StatusKind; value: string }) {
  return <StatusBadge kind={kind} value={value as never} />;
}

describe("StatusBadge", () => {
  it("covers every mapped value", () => {
    const mapped = Object.entries(statusTones).flatMap(([kind, tones]) =>
      Object.keys(tones).map((value) => `${kind}.${value}`),
    );
    expect(mapped.sort()).toEqual(
      expected.map(([kind, value]) => `${kind}.${value}`).sort(),
    );
  });

  it.each(expected)("%s %s has tone %s", (kind, value, tone) => {
    const { container } = renderWithIntl(<Badge kind={kind} value={value} />);
    expect(
      container.querySelector("[data-tone]")?.getAttribute("data-tone"),
    ).toBe(tone);
  });

  it.each(expected)("%s %s has a label in both languages", (kind, value) => {
    for (const locale of ["en", "ar"] as const) {
      const labels: Record<string, string> =
        messagesByLocale[locale].shared.status[kind];
      const label = labels[value] ?? "";
      const { unmount } = renderWithIntl(
        <Badge kind={kind} value={value} />,
        locale,
      );

      expect(label).not.toBe("");
      expect(screen.getByText(label)).toBeTruthy();
      unmount();
    }
  });

  it("shows a neutral badge with a generic label for an unknown value", () => {
    const { container } = renderWithIntl(
      <Badge kind="queue" value="on_mars" />,
    );

    expect(
      container.querySelector("[data-tone]")?.getAttribute("data-tone"),
    ).toBe("neutral");
    expect(
      screen.getByText(messagesByLocale.en.shared.status.unknown),
    ).toBeTruthy();
  });

  it("doesn't treat inherited property names as known", () => {
    renderWithIntl(<Badge kind="queue" value="constructor" />);
    expect(
      screen.getByText(messagesByLocale.en.shared.status.unknown),
    ).toBeTruthy();
  });
});
