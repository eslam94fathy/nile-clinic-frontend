import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
const posted: unknown[] = [];
let deliver: (() => void) | undefined;

class FakeChannel {
  postMessage(message: unknown) {
    posted.push(message);
  }
  addEventListener(_type: string, listener: () => void) {
    deliver = listener;
  }
  removeEventListener() {
    deliver = undefined;
  }
}

async function load() {
  vi.resetModules();
  return import("./session-end");
}

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

describe("leaveAfterSignOut", () => {
  it("goes to sign-in and tells other tabs", async () => {
    const { leaveAfterSignOut } = await load();
    leaveAfterSignOut();

    expect(replace).toHaveBeenCalledWith("/ar/sign-in");
    expect(posted).toEqual(["ended"]);
  });
});

describe("followSessionEndInOtherTabs", () => {
  it("leaves when another tab ends the session", async () => {
    const { followSessionEndInOtherTabs } = await load();
    followSessionEndInOtherTabs();
    deliver?.();

    expect(replace).toHaveBeenCalledWith("/ar/sign-in");
  });

  it("stops listening", async () => {
    const { followSessionEndInOtherTabs } = await load();
    const stop = followSessionEndInOtherTabs();
    stop();

    expect(deliver).toBeUndefined();
  });
});
