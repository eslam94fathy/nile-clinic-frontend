import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Logo } from "./logo";

afterEach(cleanup);

describe("Logo", () => {
  it("is one image named after the clinic, showing both names", () => {
    render(<Logo name="First name" tagline="Second name" direction="ltr" />);

    const image = screen.getByRole("img", { name: "First name" });
    expect(image.textContent).toContain("First name");
    expect(image.textContent).toContain("Second name");
  });

  it("puts the mark first in English and on the right in Arabic", () => {
    const { container, rerender } = render(
      <Logo name="Name" tagline="Tagline" direction="ltr" />,
    );
    const mark = () => container.querySelector("g")?.getAttribute("transform");
    expect(mark()).toBe("translate(0 5)");

    rerender(<Logo name="Name" tagline="Tagline" direction="rtl" />);
    expect(mark()).toBe("translate(380 5)");
  });

  it("keeps its own direction, whatever the page's is", () => {
    render(<Logo name="Name" tagline="Tagline" direction="rtl" />);

    expect(screen.getByRole("img").getAttribute("direction")).toBe("ltr");
  });
});
