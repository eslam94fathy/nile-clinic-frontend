import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { ClinicDate } from "./clinic-date";
import { ClinicTime } from "./clinic-time";
import { Instant } from "./instant";
import { LtrText } from "./ltr-text";
import { Money } from "./money";
import { UserText } from "./user-text";

afterEach(cleanup);

const noValue = {
  en: messagesByLocale.en.shared.noValue,
  ar: messagesByLocale.ar.shared.noValue,
};

describe("no value", () => {
  it.each([
    ["money, null", <Money key="a" value={null} />],
    ["money, malformed", <Money key="b" value="abc" />],
    ["date, null", <ClinicDate key="c" value={null} />],
    ["date, malformed", <ClinicDate key="d" value="2026-13-45" />],
    ["time, null", <ClinicTime key="e" value={null} />],
    ["time, malformed", <ClinicTime key="f" value="25:00" />],
    ["instant, null", <Instant key="g" value={null} timeZone="Africa/Cairo" />],
    [
      "instant, malformed",
      <Instant key="h" value="yesterday" timeZone="Africa/Cairo" />,
    ],
  ])("%s shows the accessible display in both languages", (_label, ui) => {
    for (const locale of ["en", "ar"] as const) {
      const { container, unmount } = renderWithIntl(ui, locale);
      expect(container.textContent).toContain(noValue[locale]);
      expect(container.querySelector("[aria-hidden]")?.textContent).toBe("—");
      unmount();
    }
  });
});

describe("Money", () => {
  it("isolates the amount without forcing a direction", () => {
    const { container } = renderWithIntl(<Money value="150.00" />, "ar");
    const bdi = container.querySelector("bdi");

    expect(bdi?.textContent).toContain("150.00");
    expect(bdi?.getAttribute("dir")).toBeNull();
  });
});

describe("ClinicDate", () => {
  it("shows the date as sent, left to right, in a time element", () => {
    const { container } = renderWithIntl(
      <ClinicDate value="2026-11-08" />,
      "ar",
    );

    expect(container.querySelector("bdi")?.getAttribute("dir")).toBe("ltr");
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-11-08",
    );
    expect(container.textContent).toBe("2026-11-08");
  });
});

describe("ClinicTime", () => {
  it.each(["09:20", "24:00"])("shows %s as sent, left to right", (value) => {
    const { container } = renderWithIntl(<ClinicTime value={value} />, "ar");

    expect(container.querySelector("bdi")?.getAttribute("dir")).toBe("ltr");
    expect(container.textContent).toBe(value);
  });
});

describe("Instant", () => {
  it("shows both spellings the same, in the given zone", () => {
    const micro = renderWithIntl(
      <Instant value="2026-11-05T22:30:00.000000Z" timeZone="Africa/Cairo" />,
    );
    const offset = renderWithIntl(
      <Instant value="2026-11-05T22:30:00+00:00" timeZone="Africa/Cairo" />,
    );

    expect(micro.container.textContent).toContain("Nov 6");
    expect(micro.container.textContent).toBe(offset.container.textContent);
    expect(
      micro.container.querySelector("time")?.getAttribute("datetime"),
    ).toBe("2026-11-05T22:30:00.000Z");
  });
});

describe("text wrappers", () => {
  it("LtrText is isolated and left to right", () => {
    const { container } = renderWithIntl(<LtrText>{"+201000000017"}</LtrText>);
    expect(container.querySelector("bdi")?.getAttribute("dir")).toBe("ltr");
  });

  it("UserText takes its direction from its content, unchanged", () => {
    const { container } = renderWithIntl(<UserText>{"مريض تجريبي"}</UserText>);
    expect(container.querySelector("bdi")?.getAttribute("dir")).toBe("auto");
    expect(container.textContent).toBe("مريض تجريبي");
  });
});
