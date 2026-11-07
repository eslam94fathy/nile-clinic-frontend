import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const posted: unknown[] = [];
let deliver: ((event: { data: unknown }) => void) | undefined;

class FakeChannel {
  postMessage(message: unknown) {
    posted.push(message);
  }
  addEventListener(
    _type: string,
    listener: (event: { data: unknown }) => void,
  ) {
    deliver = listener;
  }
  removeEventListener() {
    deliver = undefined;
  }
}

async function load() {
  vi.resetModules();
  const unsaved = await import("@/lib/unsaved-changes");
  const session = await import("./session-end");
  return { ...session, unsaved };
}

const holder = () => ({
  discard: vi.fn(),
  ask: vi.fn(),
  sessionEnded: vi.fn(),
});

beforeEach(() => {
  replace.mockClear();
  posted.length = 0;
  deliver = undefined;
  vi.stubGlobal("BroadcastChannel", FakeChannel);
  vi.stubGlobal("location", { pathname: "/ar/queue", replace });
});

describe("endSession", () => {
  it("does a full navigation through the session-ended route", async () => {
    const { endSession } = await load();
    endSession();

    expect(replace).toHaveBeenCalledWith(
      "/api/auth/session-ended?locale=ar&return=%2Far%2Fqueue",
    );
  });

  it("redirects once, however many failures arrive", async () => {
    const { endSession } = await load();
    endSession();
    endSession();
    endSession();

    expect(replace).toHaveBeenCalledTimes(1);
    expect(posted).toHaveLength(1);
  });

  it("tells other tabs", async () => {
    const { endSession } = await load();
    endSession();
    expect(posted).toEqual(["ended"]);
  });

  it("still works where tabs can't talk to each other", async () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const { endSession } = await load();
    endSession();
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe("the guard on leaving", () => {
  it.each(["endSession", "leaveAfterSignOut"] as const)(
    "stands aside for %s, so that nothing can stop it",
    async (name) => {
      const loaded = await load();
      loaded.unsaved.holdUnsaved(holder());
      loaded[name]();
      expect(loaded.unsaved.hasUnsaved()).toBe(false);
    },
  );
});

describe("leaveAfterSignOut", () => {
  it("goes to sign-in and tells other tabs", async () => {
    const { leaveAfterSignOut } = await load();
    leaveAfterSignOut();

    expect(replace).toHaveBeenCalledWith("/ar/sign-in");
    expect(posted).toEqual(["signed-out"]);
  });
});

describe("followSessionEndInOtherTabs", () => {
  it.each(["ended", "signed-out"])(
    "leaves on %s when nothing would be lost",
    async (data) => {
      const { followSessionEndInOtherTabs } = await load();
      followSessionEndInOtherTabs();
      deliver?.({ data });

      expect(replace).toHaveBeenCalledWith("/ar/sign-in");
    },
  );

  it("stays with unsaved text when the session ended by itself", async () => {
    const { followSessionEndInOtherTabs, unsaved } = await load();
    const held = holder();
    unsaved.holdUnsaved(held);
    followSessionEndInOtherTabs();
    deliver?.({ data: "ended" });

    expect(replace).not.toHaveBeenCalled();
    expect(held.sessionEnded).toHaveBeenCalledOnce();
  });

  it("leaves with unsaved text when someone signed out, as they meant it", async () => {
    const { followSessionEndInOtherTabs, unsaved } = await load();
    const held = holder();
    unsaved.holdUnsaved(held);
    followSessionEndInOtherTabs();
    deliver?.({ data: "signed-out" });

    expect(replace).toHaveBeenCalledWith("/ar/sign-in");
    expect(held.sessionEnded).not.toHaveBeenCalled();
    expect(unsaved.hasUnsaved()).toBe(false);
  });

  it("stops listening", async () => {
    const { followSessionEndInOtherTabs } = await load();
    const stop = followSessionEndInOtherTabs();
    stop();

    expect(deliver).toBeUndefined();
  });
});
