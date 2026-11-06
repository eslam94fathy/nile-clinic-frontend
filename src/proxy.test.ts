// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import proxy from "./proxy";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, "http://clinic.test"), { headers });
}

function redirectOf(path: string, headers?: Record<string, string>) {
  const response = proxy(request(path, headers));
  return { status: response.status, to: response.headers.get("location") };
}

describe("addresses without a supported language", () => {
  it("sends a bare address to Arabic by default", () => {
    expect(redirectOf("/")).toEqual({
      status: 307,
      to: "http://clinic.test/ar",
    });
  });

  it("ignores the browser's language", () => {
    expect(redirectOf("/", { "accept-language": "en-US,en" }).to).toBe(
      "http://clinic.test/ar",
    );
  });

  it("follows the saved choice over the browser's language", () => {
    const headers = { cookie: "NEXT_LOCALE=en", "accept-language": "ar" };
    expect(redirectOf("/", headers).to).toBe("http://clinic.test/en");
  });

  it("ignores an unsupported saved choice", () => {
    expect(redirectOf("/", { cookie: "NEXT_LOCALE=fr" }).to).toBe(
      "http://clinic.test/ar",
    );
  });

  it("keeps the path under the visitor's language", () => {
    expect(redirectOf("/fr/page").to).toBe("http://clinic.test/ar/fr/page");
  });

  it("does not treat a different letter case as a supported language", () => {
    expect(redirectOf("/AR").to).toBe("http://clinic.test/ar/AR");
  });

  it("preserves the query string", () => {
    expect(redirectOf("/?a=1&b=2").to).toBe("http://clinic.test/ar?a=1&b=2");
  });

  it("stays on the same origin for a path that looks like another host", () => {
    const response = proxy(new NextRequest("http://clinic.test//evil.test/x"));
    expect(response.headers.get("location")).toMatch(
      /^http:\/\/clinic\.test\/ar\//,
    );
  });
});

const WITH_SESSION = { cookie: "nile_session=sealed-value" };

const rewriteOf = (path: string, headers?: Record<string, string>) =>
  proxy(request(path, headers)).headers.get("x-middleware-rewrite");

describe("a language with no page", () => {
  it.each(["ar", "en"])("sends /%s to sign-in with no session", (locale) => {
    expect(redirectOf(`/${locale}`)).toEqual({
      status: 307,
      to: `http://clinic.test/${locale}/sign-in`,
    });
  });

  it.each(["ar", "en"])("sends /%s to the landing page with one", (locale) => {
    expect(redirectOf(`/${locale}`, WITH_SESSION).to).toBe(
      `http://clinic.test/${locale}/dashboard`,
    );
  });
});

describe("signed-in addresses with no session", () => {
  it.each([
    ["/ar/dashboard", "http://clinic.test/ar/sign-in?return=%2Fdashboard"],
    ["/en/queue", "http://clinic.test/en/sign-in?return=%2Fqueue"],
    ["/en/my/queue", "http://clinic.test/en/sign-in?return=%2Fmy%2Fqueue"],
  ])("sends %s to sign-in, in its language", (path, to) => {
    expect(redirectOf(path)).toEqual({ status: 307, to });
  });

  it("drops the query, which could hold patient details", () => {
    expect(redirectOf("/en/patients?search=Synthetic").to).toBe(
      "http://clinic.test/en/sign-in?return=%2Fpatients",
    );
  });

  it("gives no return address for a page that writes an audit entry", () => {
    expect(redirectOf("/en/patients/5").to).toBe(
      "http://clinic.test/en/sign-in",
    );
    expect(redirectOf("/en/audit").to).toBe("http://clinic.test/en/sign-in");
  });
});

describe("signed-in addresses with a session", () => {
  it.each(["/ar/dashboard", "/en/queue", "/en/my/queue", "/en/patients/5"])(
    "lets %s through, for its page to decide",
    (path) => {
      expect(redirectOf(path, WITH_SESSION).to).toBeNull();
      expect(rewriteOf(path, WITH_SESSION)).toBeNull();
    },
  );
});

describe("unknown addresses", () => {
  it.each(["/en/anything", "/ar/missing/page", "/ar/%E0%A4%A"])(
    "shows %s the public not-found page with no session",
    (path) => {
      const locale = path.slice(1, 3);
      expect(redirectOf(path).to).toBeNull();
      expect(rewriteOf(path)).toBe(
        `http://clinic.test/${locale}/address-not-found`,
      );
    },
  );

  it("lets one through with a session, for the framed not-found state", () => {
    expect(rewriteOf("/en/anything", WITH_SESSION)).toBeNull();
  });
});

describe("public addresses", () => {
  it.each(["/ar/sign-in", "/en/sign-in", "/en/address-not-found"])(
    "lets %s through with no session",
    (path) => {
      expect(redirectOf(path).to).toBeNull();
      expect(rewriteOf(path)).toBeNull();
    },
  );

  it.each(["/en/sign-in/x", "/en/address-not-found/x"])(
    "treats the deeper %s as unknown",
    (path) => {
      expect(rewriteOf(path)).toBe("http://clinic.test/en/address-not-found");
    },
  );

  it("lets sign-in through with a session, for the page to decide", () => {
    expect(redirectOf("/en/sign-in", WITH_SESSION).to).toBeNull();
  });
});

describe("the design preview address", () => {
  it.each(["/ar/design-preview", "/en/design-preview", "/ar/design-preview/x"])(
    "treats %s as unknown when the setting is unset, with no session",
    (path) => {
      expect(rewriteOf(path)).toBe(
        `http://clinic.test/${path.slice(1, 3)}/address-not-found`,
      );
    },
  );

  it("treats it as unknown with a session too", () => {
    expect(rewriteOf("/ar/design-preview", WITH_SESSION)).toBe(
      "http://clinic.test/ar/__unknown",
    );
  });

  it.each([
    "/ar/design%2Dpreview",
    "/ar/%64esign-preview",
    "/ar/design%2dpreview",
  ])("also catches the encoded %s", (path) => {
    expect(rewriteOf(path)).toBe("http://clinic.test/ar/address-not-found");
    expect(rewriteOf(path, WITH_SESSION)).toBe(
      "http://clinic.test/ar/__unknown",
    );
  });

  it("does the same when the setting is false", () => {
    vi.stubEnv("DESIGN_PREVIEW_ENABLED", "false");
    expect(rewriteOf("/ar/design-preview")).toBe(
      "http://clinic.test/ar/address-not-found",
    );
  });

  it("drops the query", () => {
    expect(rewriteOf("/ar/design-preview?a=1")).toBe(
      "http://clinic.test/ar/address-not-found",
    );
  });

  it("passes through when the setting is true", () => {
    vi.stubEnv("DESIGN_PREVIEW_ENABLED", "true");
    expect(rewriteOf("/ar/design-preview")).toBeNull();
    expect(redirectOf("/ar/design-preview").to).toBeNull();
  });

  it("treats a deeper address as unknown even when the setting is true", () => {
    vi.stubEnv("DESIGN_PREVIEW_ENABLED", "true");
    expect(rewriteOf("/ar/design-preview/x")).toBe(
      "http://clinic.test/ar/address-not-found",
    );
  });

  it("doesn't catch a similar address when there's a session", () => {
    expect(rewriteOf("/ar/design-previewx", WITH_SESSION)).toBeNull();
  });
});
