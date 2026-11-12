import { expect, type APIResponse, test } from "@playwright/test";
import { securityHeaders } from "../src/lib/security/headers";
import { resetBackend, signIn } from "./support/auth";

test.beforeEach(resetBackend);

// A production build, so the policy has no `'unsafe-eval'` (ADR 0021).
const EXPECTED = securityHeaders(false);

function expectSecurityHeaders(response: APIResponse, what: string) {
  const headers = response.headers();
  for (const { key, value } of EXPECTED) {
    expect(headers[key.toLowerCase()], `${key} on ${what}`).toBe(value);
  }
  // The reverse proxy's, as the application is also reached over plain HTTP (research R2).
  expect(headers["strict-transport-security"], what).toBeUndefined();
}

test("a public page carries every header, and stays prerendered", async ({
  request,
}) => {
  const response = await request.get("/ar/sign-in");
  expect(response.status()).toBe(200);
  expectSecurityHeaders(response, "/ar/sign-in");
  expect(response.headers()["cache-control"]).toContain("private");
  expect(response.headers()["cache-control"]).toContain("no-store");
  // Losing the prerendered shell would mean something read the request too early (T025).
  expect(response.headers()["x-nextjs-prerender"]).toBe("1");
});

test("signed-in pages, the not-found state, and the routes carry every header", async ({
  page,
}) => {
  await signIn(page, "receptionist");
  const request = page.request;

  const dashboard = await request.get("/en/dashboard");
  expectSecurityHeaders(dashboard, "/en/dashboard");
  expect(dashboard.headers()["cache-control"]).toContain("no-store");
  expect(dashboard.headers()["x-nextjs-prerender"]).toBe("1");

  const missing = await request.get("/en/no-such-page");
  expectSecurityHeaders(missing, "the framed not-found state");

  const me = await request.get("/api/backend/auth/me", {
    headers: { Accept: "application/json" },
  });
  expect(me.status()).toBe(200);
  expectSecurityHeaders(me, "/api/backend/auth/me");
  expect(me.headers()["cache-control"]).toBe("no-store");

  // No Origin, so the route refuses it, and still answers with the headers.
  const refused = await request.post("/api/auth/sign-in", {
    headers: { Origin: "https://elsewhere.example" },
    data: {},
  });
  expect(refused.status()).toBe(403);
  expectSecurityHeaders(refused, "/api/auth/sign-in");
  expect(refused.headers()["cache-control"]).toBe("no-store");
});

test("the health route carries every header, and isn't stored", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expectSecurityHeaders(response, "/api/health");
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("static files carry every header", async ({ request }) => {
  const html = await (await request.get("/ar/sign-in")).text();
  const chunk = /\/_next\/static\/chunks\/[^"]+\.js/.exec(html)?.[0];
  expect(chunk).toBeDefined();

  const response = await request.get(chunk ?? "");
  expect(response.status()).toBe(200);
  expectSecurityHeaders(response, "a static chunk");
});
