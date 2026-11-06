import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";
import { useClearOnLeave } from "./use-clear-on-leave";

afterEach(cleanup);

const CLEARED = ["secret"] as const;

function Form() {
  const { register, resetField } = useForm({
    defaultValues: { secret: "", other: "" },
  });
  useClearOnLeave(resetField, CLEARED);

  return (
    <form>
      <input aria-label="secret" {...register("secret")} />
      <input aria-label="other" {...register("other")} />
    </form>
  );
}

// Next.js keeps a visited page mounted inside a hidden Activity, so this is how leaving a page behaves.
function Page({ hidden }: { hidden: boolean }) {
  return (
    <Activity mode={hidden ? "hidden" : "visible"}>
      <Form />
    </Activity>
  );
}

const field = (label: string) =>
  screen.getByLabelText(label, { selector: "input" }) as HTMLInputElement;

describe("useClearOnLeave", () => {
  it("keeps what's typed while the form is in use", () => {
    const { rerender } = render(<Page hidden={false} />);
    fireEvent.change(field("secret"), { target: { value: "typed" } });

    rerender(<Page hidden={false} />);

    expect(field("secret").value).toBe("typed");
  });

  it("clears the named fields when the page is hidden, even from the hidden page", () => {
    const { rerender, container } = render(<Page hidden={false} />);
    fireEvent.change(field("secret"), { target: { value: "typed" } });

    rerender(<Page hidden />);

    const hidden = container.querySelector<HTMLInputElement>(
      'input[name="secret"]',
    );
    expect(hidden?.value).toBe("");
  });

  it("leaves other fields alone", () => {
    const { rerender, container } = render(<Page hidden={false} />);
    fireEvent.change(field("other"), { target: { value: "kept" } });

    rerender(<Page hidden />);

    expect(
      container.querySelector<HTMLInputElement>('input[name="other"]')?.value,
    ).toBe("kept");
  });

  it("is still clear when the person comes back", () => {
    const { rerender } = render(<Page hidden={false} />);
    fireEvent.change(field("secret"), { target: { value: "typed" } });

    rerender(<Page hidden />);
    rerender(<Page hidden={false} />);

    expect(field("secret").value).toBe("");
  });
});
