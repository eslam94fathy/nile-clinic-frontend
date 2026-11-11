import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAllStaff } from "./staff-server";

const serverApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/server-api", () => ({ serverApi }));

const member = (id: number) => ({
  id,
  name: `Synthetic Staff ${id}`,
  email: `staff${id}@example.test`,
  role: "receptionist",
  is_active: id % 2 === 0,
  created_at: "2026-11-01T08:00:00.000000Z",
  updated_at: "2026-11-01T08:00:00.000000Z",
});
const page = (current: number, last: number, ...ids: number[]) => ({
  ok: true,
  status: 200,
  data: {
    data: ids.map(member),
    meta: {
      current_page: current,
      last_page: last,
      per_page: 100,
      total: ids.length,
      from: 1,
      to: ids.length,
    },
  },
});

beforeEach(() => serverApi.mockReset());

describe("readAllStaff", () => {
  it("follows every page, including deactivated accounts", async () => {
    serverApi.mockResolvedValueOnce(page(1, 2, 1, 2));
    serverApi.mockResolvedValueOnce(page(2, 2, 3));

    const result = await readAllStaff("en");

    expect(serverApi).toHaveBeenCalledTimes(2);
    expect(serverApi.mock.calls[0]?.[0]).toBe("staff?per_page=100&page=1");
    expect(serverApi.mock.calls[1]?.[0]).toBe("staff?per_page=100&page=2");
    expect(result.ok && result.data.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  it("reads the pages after the first together, keeping their order", async () => {
    serverApi.mockResolvedValueOnce(page(1, 3, 1));
    let finishSecond: (value: unknown) => void = () => undefined;
    serverApi.mockReturnValueOnce(
      new Promise((done) => {
        finishSecond = done;
      }),
    );
    serverApi.mockResolvedValueOnce(page(3, 3, 3));

    const reading = readAllStaff("en");
    await vi.waitFor(() => expect(serverApi).toHaveBeenCalledTimes(3));
    finishSecond(page(2, 3, 2));

    const result = await reading;
    expect(serverApi.mock.calls[2]?.[0]).toBe("staff?per_page=100&page=3");
    expect(result.ok && result.data.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  it("reads one page when there is only one", async () => {
    serverApi.mockResolvedValueOnce(page(1, 1, 1));
    await readAllStaff("en");
    expect(serverApi).toHaveBeenCalledOnce();
  });

  it("fails as a whole if a page fails", async () => {
    const failed = { ok: false, error: { status: 500, fieldErrors: {} } };
    serverApi.mockResolvedValueOnce(page(1, 2, 1));
    serverApi.mockResolvedValueOnce(failed);

    expect(await readAllStaff("en")).toEqual(failed);
  });
});
