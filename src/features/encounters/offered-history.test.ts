import { describe, expect, it } from "vitest";
import {
  offeredForDraft,
  offeredForQueueRow,
  offeredForVisit,
  patientsOnTodaysList,
} from "./offered-history";

const today = patientsOnTodaysList([
  { status: "waiting", patient: { id: 1 } },
  { status: "with_doctor", patient: { id: 2 } },
  { status: "seen", patient: { id: 3 } },
  { status: "left", patient: { id: 4 } },
]);

describe("patientsOnTodaysList", () => {
  it("counts everyone except those who left", () => {
    expect([...today]).toEqual([1, 2, 3]);
  });
});

describe("offeredForQueueRow", () => {
  it.each([
    ["waiting", true],
    ["with_doctor", true],
    ["seen", true],
    ["left", false],
  ])("%s gives %s", (status, expected) => {
    expect(offeredForQueueRow(status)).toBe(expected);
  });
});

describe("offeredForVisit", () => {
  it("offers a finalized visit's patient, whoever is on the list", () => {
    expect(offeredForVisit("finalized", 9, today)).toBe(true);
    expect(offeredForVisit("finalized", 9, null)).toBe(true);
  });

  it("offers a patient on today's list, whatever the record", () => {
    expect(offeredForVisit("none", 1, today)).toBe(true);
    expect(offeredForVisit("draft", 3, today)).toBe(true);
  });

  it("doesn't offer anyone else, as a refusal would be recorded", () => {
    expect(offeredForVisit("none", 9, today)).toBe(false);
    expect(offeredForVisit("draft", 4, today)).toBe(false);
  });

  it("offers nothing on that basis when the list isn't known", () => {
    expect(offeredForVisit("none", 1, null)).toBe(false);
  });
});

describe("offeredForDraft", () => {
  it("offers only a patient on today's list", () => {
    expect(offeredForDraft(2, today)).toBe(true);
    expect(offeredForDraft(4, today)).toBe(false);
    expect(offeredForDraft(9, today)).toBe(false);
  });

  it("offers nothing when the list isn't known", () => {
    expect(offeredForDraft(1, null)).toBe(false);
  });
});
