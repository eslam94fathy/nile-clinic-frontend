// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/health", () => {
  it("says the frontend is serving, reads nothing, and isn't stored", async () => {
    vi.stubGlobal("fetch", fetchMock);
    // Imported here, so that it can't have read a setting while loading.
    const { GET } = await import("./route");

    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    // A backend outage mustn't make the frontend look unhealthy (owner's choice).
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
