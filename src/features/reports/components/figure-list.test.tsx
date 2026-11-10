import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test-support/render-with-intl";
import { FigureList } from "./figure-list";

afterEach(cleanup);

describe("FigureList", () => {
  it("pairs each label with its value, under a heading", () => {
    renderWithIntl(
      <FigureList
        heading="All doctors"
        figures={[
          { id: "a", label: "Received", value: "EGP 350.00" },
          { id: "b", label: "Refunded", value: "EGP 0.00" },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "All doctors" })).toBeDefined();
    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    const values = screen
      .getAllByRole("definition")
      .map((value) => value.textContent);
    expect(terms).toEqual(["Received", "Refunded"]);
    expect(values).toEqual(["EGP 350.00", "EGP 0.00"]);
  });

  it("needs no heading", () => {
    renderWithIntl(
      <FigureList figures={[{ id: "a", label: "Net", value: "1" }]} />,
    );
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
