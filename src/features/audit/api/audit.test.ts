import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchAuditEntries } from "./audit";

const { browserApi } = vi.hoisted(() => ({ browserApi: vi.fn() }));
vi.mock("@/lib/api/browser-api", () => ({ browserApi }));

const body = {
  data: [],
  meta: { per_page: 25, next_cursor: null, prev_cursor: null },
};

beforeEach(() => {
  browserApi.mockReset();
  browserApi.mockResolvedValue({ ok: true, status: 200, data: body });
});

const pathOf = (call = 0) => String(browserApi.mock.calls[call]?.[0]);

describe("searchAuditEntries", () => {
  it("sends only the filters that are set, the page size, and no cursor at first", async () => {
    const result = await searchAuditEntries(
      { patient_id: 12, action: "patient.opened" },
      null,
      "ar",
    );

    expect(pathOf()).toBe(
      "audit-entries?patient_id=12&action=patient.opened&per_page=25",
    );
    expect(browserApi.mock.calls[0]?.[1]).toEqual({ locale: "ar" });
    expect(result).toEqual({ ok: true, status: 200, data: body });
  });

  it("sends nothing but the page size with no filters", async () => {
    await searchAuditEntries({}, null, "en");
    expect(pathOf()).toBe("audit-entries?per_page=25");
  });

  it("sends the same filters with a cursor", async () => {
    await searchAuditEntries({ from: "2026-11-01" }, "eyJpZCI6MX0", "en");
    expect(pathOf()).toBe(
      "audit-entries?from=2026-11-01&per_page=25&cursor=eyJpZCI6MX0",
    );
  });

  it("encodes a cursor's characters", async () => {
    await searchAuditEntries({}, "a+b/c=", "en");
    expect(pathOf()).toBe("audit-entries?per_page=25&cursor=a%2Bb%2Fc%3D");
  });

  it("passes a refusal through, once, with no retry", async () => {
    const refused = { ok: false, error: { status: 422, fieldErrors: {} } };
    browserApi.mockResolvedValueOnce(refused);

    expect(await searchAuditEntries({}, null, "en")).toEqual(refused);
    expect(browserApi).toHaveBeenCalledTimes(1);
  });

  it("treats a body of the wrong shape as a failure", async () => {
    browserApi.mockResolvedValueOnce({ ok: true, status: 200, data: {} });
    const result = await searchAuditEntries({}, null, "en");
    expect(result.ok).toBe(false);
  });
});
