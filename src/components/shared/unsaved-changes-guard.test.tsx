import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  askBeforeLeaving,
  hasUnsaved,
  resetUnsavedForTests,
  standAside,
  tellSessionEnded,
} from "@/lib/unsaved-changes";
import en from "@/messages/en.json";
import { UnsavedChangesGuard } from "./unsaved-changes-guard";

const t = en.shared.unsaved;

class FakeNavigation extends EventTarget {
  traverseTo = vi.fn();
}
let navigation: FakeNavigation;

function setUp(unsaved = true) {
  const onDiscard = vi.fn();
  const onSessionEnded = vi.fn();
  const followed = vi.fn((event: { preventDefault: () => void }) =>
    event.preventDefault(),
  );
  const view = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <UnsavedChangesGuard
        unsaved={unsaved}
        onDiscard={onDiscard}
        onSessionEnded={onSessionEnded}
      />
      <a href="https://example.test/elsewhere" onClick={followed}>
        Elsewhere
      </a>
      <a href="#main">Skip</a>
      <button type="button">Not a link</button>
    </NextIntlClientProvider>,
  );
  return {
    ...view,
    onDiscard,
    onSessionEnded,
    followed,
    link: screen.getByRole("link", { name: "Elsewhere" }),
  };
}

const dialog = () => screen.queryByRole("alertdialog");
const choose = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));

function traverse(cancelable = true, key: string | null = "earlier") {
  const event = Object.assign(new Event("navigate", { cancelable: true }), {
    navigationType: "traverse",
    destination: { key },
  });
  Object.defineProperty(event, "cancelable", { value: cancelable });
  const preventDefault = vi.spyOn(event, "preventDefault");
  act(() => {
    navigation.dispatchEvent(event);
  });
  return preventDefault;
}

beforeEach(() => {
  navigation = new FakeNavigation();
  vi.stubGlobal("navigation", navigation);
});

afterEach(() => {
  cleanup();
  resetUnsavedForTests();
  vi.unstubAllGlobals();
});

describe("UnsavedChangesGuard", () => {
  it("does nothing with nothing to lose", () => {
    const { link, followed } = setUp(false);
    fireEvent.click(link);
    expect(followed).toHaveBeenCalledOnce();
    expect(dialog()).toBeNull();
    expect(hasUnsaved()).toBe(false);
  });

  it("stops a link and asks, on the safe choice", () => {
    const { link, followed } = setUp();
    fireEvent.click(link);

    expect(followed).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: t.stay }),
    );
  });

  it("keeps everything on staying", () => {
    const { link, followed, onDiscard } = setUp();
    fireEvent.click(link);
    choose(t.stay);

    expect(dialog()).toBeNull();
    expect(onDiscard).not.toHaveBeenCalled();
    expect(followed).not.toHaveBeenCalled();
    expect(hasUnsaved()).toBe(true);
  });

  it("discards, then follows the same link, on leaving", () => {
    const { link, followed, onDiscard } = setUp();
    fireEvent.click(link);
    choose(t.leave);

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(followed).toHaveBeenCalledOnce();
    expect(dialog()).toBeNull();
  });

  it.each([
    ["ctrlKey", { ctrlKey: true }],
    ["metaKey", { metaKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["another button", { button: 1 }],
  ])("lets a link open elsewhere, with %s", (_name, init) => {
    const { link, followed } = setUp();
    fireEvent.click(link, init);
    expect(followed).toHaveBeenCalledOnce();
    expect(dialog()).toBeNull();
  });

  it("ignores what isn't a link, and links within the page", () => {
    setUp();
    fireEvent.click(screen.getByRole("button", { name: "Not a link" }));
    fireEvent.click(screen.getByRole("link", { name: "Skip" }));
    expect(dialog()).toBeNull();
  });

  it("asks before something that isn't a link leaves", () => {
    setUp();
    const proceed = vi.fn();
    act(() => askBeforeLeaving(proceed));
    expect(proceed).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();

    choose(t.leave);
    expect(proceed).toHaveBeenCalledOnce();
  });

  it("asks the browser to warn on closing or reloading", () => {
    setUp();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("doesn't warn on closing once a session is really ending", () => {
    setUp();
    standAside();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("cancels back and forward, and goes there on leaving", () => {
    setUp();
    const prevented = traverse();
    expect(prevented).toHaveBeenCalledOnce();
    expect(dialog()).not.toBeNull();
    expect(navigation.traverseTo).not.toHaveBeenCalled();

    choose(t.leave);
    expect(navigation.traverseTo).toHaveBeenCalledWith("earlier");
  });

  it("stays where it is if the person stays", () => {
    setUp();
    traverse();
    choose(t.stay);
    expect(navigation.traverseTo).not.toHaveBeenCalled();
  });

  it("leaves alone what the browser won't let be cancelled", () => {
    setUp();
    expect(traverse(false)).not.toHaveBeenCalled();
    expect(dialog()).toBeNull();
  });

  it("ignores navigations that aren't back or forward", () => {
    setUp();
    const event = Object.assign(new Event("navigate", { cancelable: true }), {
      navigationType: "push",
      destination: { key: null },
    });
    act(() => {
      navigation.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
  });

  it("works where the browser has no Navigation API", () => {
    vi.stubGlobal("navigation", undefined);
    const { link } = setUp();
    fireEvent.click(link);
    expect(dialog()).not.toBeNull();
  });

  it("lets go when it's removed, as a hidden page holds nothing", () => {
    const { unmount } = setUp();
    expect(hasUnsaved()).toBe(true);
    unmount();
    expect(hasUnsaved()).toBe(false);
  });

  it("passes on that the session ended", () => {
    const { onSessionEnded } = setUp();
    act(() => {
      tellSessionEnded();
    });
    expect(onSessionEnded).toHaveBeenCalledOnce();
  });
});
