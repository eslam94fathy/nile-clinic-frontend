// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Capability, can, ROLE_CAPABILITIES } from "./permissions";

// Each row of the documented matrix, by the start of its first cell.
const ROWS: Record<string, Capability> = {
  "Own profile": "ownAccount",
  "Manage staff": "manageStaff",
  "Read specialties": "readDoctors",
  "Change specialties": "manageDoctors",
  "Read any doctor": "readSchedules",
  "Change schedules": "manageSchedules",
  Patients: "managePatients",
  "Appointments:": "manageAppointments",
  "Own appointments": "readOwnAppointments",
  "Queue:": "manageQueue",
  "Own queue": "ownQueue",
  "Medical records": "medicalRecords",
  "Read fees": "readFees",
  "Set fees": "setFees",
  "Visits and charges": "billing",
  "Discount and refund": "discountAndRefund",
  Reports: "reports",
  "Audit trail": "auditTrail",
};

function matrixRows() {
  const document = readFileSync("docs/backend-integration.md", "utf8");
  const section = document.split("## Permission matrix")[1] ?? "";
  const table =
    section.split("\n\n").find((part) => part.startsWith("|")) ?? "";

  return table
    .split("\n")
    .slice(2)
    .filter(Boolean)
    .map((line) => {
      const [label = "", a = "", r = "", d = ""] = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      return { label, a, r, d };
    });
}

describe("the role map", () => {
  const rows = matrixRows();

  it("finds the whole documented matrix", () => {
    expect(rows).toHaveLength(Object.keys(ROWS).length);
    expect(Object.keys(ROLE_CAPABILITIES)).toHaveLength(rows.length);
  });

  it.each(rows)("agrees with the matrix for: $label", ({ label, a, r, d }) => {
    const key = Object.keys(ROWS).find((start) => label.startsWith(start));
    const capability = key ? ROWS[key] : undefined;
    if (!capability) throw new Error(`No capability for the row: ${label}`);

    expect({
      administrator: can("administrator", capability),
      receptionist: can("receptionist", capability),
      doctor: can("doctor", capability),
    }).toEqual({
      administrator: a.includes("✓"),
      receptionist: r.includes("✓"),
      doctor: d.includes("✓"),
    });
  });

  it("uses each capability for exactly one row", () => {
    expect(new Set(Object.values(ROWS)).size).toBe(rows.length);
  });
});
