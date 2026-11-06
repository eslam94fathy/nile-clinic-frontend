import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { takeAsked } from "../opening";
import { PatientLink } from "./patient-link";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => (
    <a
      data-prefetch={String(prefetch)}
      {...props}
      // Stops jsdom from trying to navigate.
      onClick={(event) => {
        props.onClick?.(event);
        event.preventDefault();
      }}
    />
  ),
}));

afterEach(cleanup);
beforeEach(() => {
  takeAsked(5);
});

const link = () => {
  render(<PatientLink id={5}>{"Open"}</PatientLink>);
  return screen.getByRole("link", { name: "Open" });
};

describe("PatientLink", () => {
  it("leads to the record, with no prefetch", () => {
    const element = link();
    expect(element.getAttribute("href")).toBe("/patients/5");
    expect(element.getAttribute("data-prefetch")).toBe("false");
  });

  it("marks nothing just by being shown or hovered", () => {
    fireEvent.mouseEnter(link());
    expect(takeAsked(5)).toBe(false);
  });

  it("marks the record on a plain click", () => {
    fireEvent.click(link());
    expect(takeAsked(5)).toBe(true);
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Alt", { altKey: true }],
    ["the middle button", { button: 1 }],
  ])(
    "leaves no mark for a click with %s, as that opens elsewhere",
    (_name, init) => {
      fireEvent.click(link(), init);
      expect(takeAsked(5)).toBe(false);
    },
  );
});
