import { afterEach, describe, expect, it, vi } from "vitest";
import {
  askBeforeLeaving,
  hasUnsaved,
  holdUnsaved,
  resetUnsavedForTests,
  standAside,
  tellSessionEnded,
} from "./unsaved-changes";

const holder = () => ({
  discard: vi.fn(),
  ask: vi.fn(),
  sessionEnded: vi.fn(),
});

afterEach(resetUnsavedForTests);

describe("unsaved changes", () => {
  it("has nothing to lose until something holds it", () => {
    expect(hasUnsaved()).toBe(false);
    const release = holdUnsaved(holder());
    expect(hasUnsaved()).toBe(true);
    release();
    expect(hasUnsaved()).toBe(false);
  });

  it("goes straight on when there's nothing to lose", () => {
    const proceed = vi.fn();
    askBeforeLeaving(proceed);
    expect(proceed).toHaveBeenCalledOnce();
  });

  it("asks first, and goes on only when the person chooses to leave", () => {
    const held = holder();
    holdUnsaved(held);
    const proceed = vi.fn();

    askBeforeLeaving(proceed);
    expect(proceed).not.toHaveBeenCalled();
    expect(held.ask).toHaveBeenCalledOnce();
  });

  it("discards, and lets go, before going on", () => {
    const held = holder();
    holdUnsaved(held);
    const seen: boolean[] = [];

    askBeforeLeaving(() => seen.push(hasUnsaved()));
    const leave = held.ask.mock.calls[0]?.[0] as () => void;
    leave();

    expect(held.discard).toHaveBeenCalledOnce();
    expect(seen).toEqual([false]);
  });

  it("doesn't let an older holder's release remove a newer one", () => {
    const releaseOld = holdUnsaved(holder());
    holdUnsaved(holder());
    releaseOld();
    expect(hasUnsaved()).toBe(true);
  });

  it("has nothing to lose once a session is really ending", () => {
    holdUnsaved(holder());
    standAside();
    expect(hasUnsaved()).toBe(false);
    expect(tellSessionEnded()).toBe(false);
  });

  it("tells a holder that the session ended, and says the page stays", () => {
    const held = holder();
    holdUnsaved(held);
    expect(tellSessionEnded()).toBe(true);
    expect(held.sessionEnded).toHaveBeenCalledOnce();
  });

  it("says the page may leave when nothing is held", () => {
    expect(tellSessionEnded()).toBe(false);
  });
});
