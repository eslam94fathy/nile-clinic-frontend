import { describe, expect, it } from "vitest";
import { stripPageLinks } from "./strip-page-links";

const PRIVATE = "http://private.test/api/v1/staff?name=Synthetic";

describe("stripPageLinks", () => {
  it("removes every field holding the private address", () => {
    const stripped = stripPageLinks({
      data: [{ id: 1 }],
      links: { first: PRIVATE, last: PRIVATE, prev: null, next: PRIVATE },
      meta: {
        current_page: 1,
        from: 1,
        last_page: 3,
        links: [{ url: PRIVATE, label: "1", page: 1, active: true }],
        path: PRIVATE,
        per_page: 15,
        to: 15,
        total: 40,
      },
      totals: { net: "10.00" },
    });

    expect(JSON.stringify(stripped)).not.toContain("private.test");
    expect(stripped).toEqual({
      data: [{ id: 1 }],
      meta: {
        current_page: 1,
        from: 1,
        last_page: 3,
        per_page: 15,
        to: 15,
        total: 40,
      },
      totals: { net: "10.00" },
    });
  });

  it("removes them from a cursor list too, keeping its cursors", () => {
    expect(
      stripPageLinks({
        data: [],
        links: { next: PRIVATE },
        meta: { path: PRIVATE, per_page: 15, next_cursor: "abc" },
      }),
    ).toEqual({ data: [], meta: { per_page: 15, next_cursor: "abc" } });
  });

  it.each([
    [{ data: { id: 1, name: "Synthetic" } }],
    [{ message: "Refused.", errors: { a: ["b"] } }],
    [[1, 2]],
    ["text"],
    [null],
  ])("leaves %j as it is", (body) => {
    expect(stripPageLinks(body)).toEqual(body);
  });
});
