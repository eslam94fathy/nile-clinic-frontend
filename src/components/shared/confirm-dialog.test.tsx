import { cleanup, fireEvent, screen } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { ConfirmDialog } from "./confirm-dialog";

afterEach(cleanup);

const text = messagesByLocale.en.shared.confirm;

type Props = Partial<ComponentProps<typeof ConfirmDialog>>;

function Example(props: Props) {
  const [open, setOpen] = useState(true);
  return (
    <ConfirmDialog
      trigger={<button>{"Open"}</button>}
      title="Cancel charge?"
      description="The visit can be charged again."
      confirmLabel="Confirm"
      pending={false}
      onConfirm={() => {}}
      open={open}
      onOpenChange={setOpen}
      {...props}
    />
  );
}

const pressEscape = () =>
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: "Escape",
  });

describe("ConfirmDialog", () => {
  it("works with no button of its own, for one that can disappear while it's open", () => {
    const onConfirm = vi.fn();
    renderWithIntl(<Example trigger={undefined} onConfirm={onConfirm} />);

    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it.each(["en", "ar"] as const)(
    "says when an action can't be undone, in %s",
    (locale) => {
      renderWithIntl(<Example irreversible />, locale);
      expect(
        screen.getByText(messagesByLocale[locale].shared.confirm.irreversible),
      ).toBeTruthy();
    },
  );

  it("doesn't claim that for an ordinary action", () => {
    renderWithIntl(<Example />);
    expect(screen.queryByText(text.irreversible)).toBeNull();
  });

  it("calls onConfirm once, and stays open", () => {
    const onConfirm = vi.fn();
    renderWithIntl(<Example onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("can't be confirmed again while pending", () => {
    const onConfirm = vi.fn();
    renderWithIntl(<Example pending onConfirm={onConfirm} />);
    const action = screen.getByRole("button", { name: text.working });

    expect(action.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(action);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("can't be closed while pending, by Escape or by Cancel", () => {
    renderWithIntl(<Example pending />);

    pressEscape();
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: text.cancel }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("closes with Escape and Cancel otherwise", () => {
    renderWithIntl(<Example />);
    pressEscape();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("shows a failure and stays open", () => {
    renderWithIntl(<Example error="It has payments." />);

    expect(screen.getByRole("alert").textContent).toBe("It has payments.");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("shows what's given to fill in, before the error", () => {
    renderWithIntl(
      <Example error="Refused.">
        <label>
          {"Reason"}
          <input />
        </label>
      </Example>,
    );
    const field = screen.getByLabelText("Reason");
    const alert = screen.getByRole("alert");
    expect(
      field.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
