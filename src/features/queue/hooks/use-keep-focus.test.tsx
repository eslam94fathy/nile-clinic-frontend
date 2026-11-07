import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeepFocus } from "./use-keep-focus";

function Stage() {
  const [shown, setShown] = useState(true);
  const keep = useKeepFocus(() => document.getElementById("heading"));
  return (
    <>
      <h2 id="heading" tabIndex={-1}>
        {"Heading"}
      </h2>
      <button onClick={() => setShown(false)}>{"Remove"}</button>
      <button>{"Elsewhere"}</button>
      <div {...keep}>{shown ? <button>{"Control"}</button> : null}</div>
    </>
  );
}

const named = (name: string) => screen.getByRole("button", { name });

afterEach(cleanup);

describe("useKeepFocus", () => {
  it("moves focus to the fallback when the control holding it goes", () => {
    render(<Stage />);
    named("Control").focus();

    fireEvent.click(named("Remove"));

    expect(document.activeElement).toBe(screen.getByText("Heading"));
  });

  it("moves nothing when focus is elsewhere", () => {
    render(<Stage />);
    named("Elsewhere").focus();

    fireEvent.click(named("Remove"));

    expect(document.activeElement).toBe(named("Elsewhere"));
  });

  it("moves nothing when someone had already left the control", async () => {
    render(<Stage />);
    named("Control").focus();
    named("Control").blur();
    // What's left to the page's start was left on purpose, once the blur has been looked at.
    await Promise.resolve();

    fireEvent.click(named("Remove"));

    expect(document.activeElement).toBe(document.body);
  });

  it("copes with no fallback being there", () => {
    const fallback = vi.fn(() => null);
    function NoHeading() {
      const [shown, setShown] = useState(true);
      const keep = useKeepFocus(fallback);
      return (
        <>
          <button onClick={() => setShown(false)}>{"Remove"}</button>
          <div {...keep}>{shown ? <button>{"Control"}</button> : null}</div>
        </>
      );
    }
    render(<NoHeading />);
    named("Control").focus();

    fireEvent.click(named("Remove"));

    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
