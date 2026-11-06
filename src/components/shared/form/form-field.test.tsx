import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { FormError } from "./form-error";
import { FormField } from "./form-field";

afterEach(cleanup);

const describedByOf = (input: HTMLElement) =>
  (input.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent);

describe("FormField", () => {
  it("ties the label to the input", () => {
    renderWithIntl(
      <FormField label="Name">{(input) => <input {...input} />}</FormField>,
    );
    expect(screen.getByLabelText("Name").tagName).toBe("INPUT");
  });

  it("describes nothing, and isn't invalid, by default", () => {
    renderWithIntl(
      <FormField label="Name">{(input) => <input {...input} />}</FormField>,
    );
    const input = screen.getByRole("textbox");

    expect(input.hasAttribute("aria-describedby")).toBe(false);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("ties the hint and error to the input, and announces the error", () => {
    renderWithIntl(
      <FormField label="Name" hint="As on their ID." error="Enter a name.">
        {(input) => <input {...input} />}
      </FormField>,
    );
    const input = screen.getByRole("textbox");

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(describedByOf(input)).toEqual(["As on their ID.", "Enter a name."]);
    expect(screen.getByRole("alert").textContent).toBe("Enter a name.");
  });

  it.each(["en", "ar"] as const)("shows required in text, in %s", (locale) => {
    renderWithIntl(
      <FormField label="Name" required>
        {(input) => <input {...input} />}
      </FormField>,
      locale,
    );
    const text = messagesByLocale[locale].shared.form.required;

    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>("textbox").required).toBe(true);
  });

  it.each(["en", "ar"] as const)(
    "ties the no medical details hint to the input, in %s",
    (locale) => {
      renderWithIntl(
        <FormField label="Reason" noMedicalDetails>
          {(input) => <input {...input} />}
        </FormField>,
        locale,
      );

      expect(describedByOf(screen.getByRole("textbox"))).toEqual([
        messagesByLocale[locale].shared.form.noMedicalDetails,
      ]);
    },
  );
});

describe("FormError", () => {
  it("shows every message, announced", () => {
    renderWithIntl(<FormError messages={["First.", "Second."]} />);
    const alert = screen.getByRole("alert");

    expect(alert.textContent).toContain("First.");
    expect(alert.textContent).toContain("Second.");
  });

  it("keeps repeated messages, without a React key error", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithIntl(<FormError messages={["Required.", "Required."]} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(logged).not.toHaveBeenCalled();
  });

  it("renders nothing with no messages", () => {
    const { container } = renderWithIntl(<FormError messages={[]} />);
    expect(container.textContent).toBe("");
  });
});
