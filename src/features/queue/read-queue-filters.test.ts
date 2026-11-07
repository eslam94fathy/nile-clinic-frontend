import { describe, expect, it } from "vitest";
import { readQueueFilters } from "./read-queue-filters";

describe("readQueueFilters", () => {
  it("gives no filters for an empty address", () => {
    expect(readQueueFilters({})).toEqual({
      doctorId: null,
      status: null,
      page: 1,
    });
  });

  it("reads valid values", () => {
    expect(readQueueFilters({ status: "with_doctor", page: "3" })).toEqual({
      doctorId: null,
      status: "with_doctor",
      page: 3,
    });
    expect(readQueueFilters({ doctor_id: "7", status: "left" })).toEqual({
      doctorId: 7,
      status: "left",
      page: 1,
    });
  });

  it.each(["abc", "0", "-1", "1.5", "", "1e3"])(
    "ignores %j as a doctor and as a page",
    (value) => {
      expect(readQueueFilters({ doctor_id: value, page: value })).toEqual({
        doctorId: null,
        status: null,
        page: 1,
      });
    },
  );

  it.each(["gone", "WAITING", "", "constructor"])(
    "ignores %j as a status",
    (value) => {
      expect(readQueueFilters({ status: value }).status).toBeNull();
    },
  );

  it("ignores a page beside a chosen doctor, whose list isn't paged", () => {
    expect(readQueueFilters({ doctor_id: "7", page: "4" }).page).toBe(1);
  });
});
