import { beforeEach, describe, expect, it, vi } from "vitest";
import { readAllDoctors } from "./doctors-server";

const serverApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/server-api", () => ({ serverApi }));

const doctor = (id: number) => ({
  id,
  name: `Synthetic Doctor ${id}`,
  title: "Consultant",
  is_active: false,
  specialties: [],
});
const page = (current: number, last: number, ...ids: number[]) => ({
  ok: true,
  status: 200,
  data: {
    data: ids.map(doctor),
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

describe("readAllDoctors", () => {
  it("follows every page, including inactive doctors", async () => {
    serverApi.mockResolvedValueOnce(page(1, 2, 1, 2));
    serverApi.mockResolvedValueOnce(page(2, 2, 3));

    const result = await readAllDoctors("en");

    expect(serverApi).toHaveBeenCalledTimes(2);
    expect(serverApi.mock.calls[0]?.[0]).toBe("doctors?per_page=100&page=1");
    expect(serverApi.mock.calls[1]?.[0]).toBe("doctors?per_page=100&page=2");
    expect(result.ok && result.data.map(({ id }) => id)).toEqual([1, 2, 3]);
  });

  it("fails as a whole if a page fails", async () => {
    const failed = { ok: false, error: { status: 500, fieldErrors: {} } };
    serverApi.mockResolvedValueOnce(page(1, 2, 1));
    serverApi.mockResolvedValueOnce(failed);

    expect(await readAllDoctors("en")).toEqual(failed);
  });
});
