import { describe, expect, it } from "vitest";
import {
  APP_ROUTES,
  canOpen,
  findRoute,
  isSignedInSegment,
  navigationFor,
  needsDoctorProfile,
  type AppRoute,
} from "./app-routes";
import { can, type Role } from "./permissions";

const labels = (role: Role) =>
  navigationFor(role).map(({ labelKey }) => labelKey);

describe("clinical screens", () => {
  const CLINICAL = ["my/visits", "my/encounters", "my/patients"];

  it.each(CLINICAL)("%s is for doctors only", (path) => {
    const route = findRoute(path);
    expect(route?.capability).toBe("medicalRecords");
    if (!route) return;
    expect(canOpen("doctor", route)).toBe(true);
    expect(canOpen("administrator", route)).toBe(false);
    expect(canOpen("receptionist", route)).toBe(false);
  });

  it.each(CLINICAL)("%s needs a doctor's profile", (path) => {
    expect(needsDoctorProfile(path)).toBe(true);
  });

  it("only my visits is in the navigation", () => {
    expect(findRoute("my/visits")?.inNavigation).toBe(true);
    expect(findRoute("my/encounters")?.inNavigation).toBe(false);
    expect(findRoute("my/patients")?.inNavigation).toBe(false);
  });
});

describe("the audit log", () => {
  it("is for administrators only", () => {
    const route = findRoute("audit");
    if (!route) return;
    expect(canOpen("administrator", route)).toBe(true);
    expect(canOpen("receptionist", route)).toBe(false);
    expect(canOpen("doctor", route)).toBe(false);
  });
});

// The table in docs/frontend-blueprint.md, in its order.
describe("each role's navigation matches the blueprint", () => {
  it("administrator", () => {
    expect(labels("administrator")).toEqual([
      "dashboard",
      "patients",
      "appointments",
      "queue",
      "billing",
      "charges",
      "doctors",
      "specialties",
      "fees",
      "staff",
      "reports",
      "audit",
    ]);
  });

  it("receptionist", () => {
    expect(labels("receptionist")).toEqual([
      "dashboard",
      "patients",
      "appointments",
      "queue",
      "billing",
      "charges",
      "doctors",
      "fees",
    ]);
  });

  it("doctor", () => {
    expect(labels("doctor")).toEqual([
      "dashboard",
      "myQueue",
      "myAppointments",
      "myVisits",
      "mySchedule",
    ]);
  });
});

describe("the route table", () => {
  const routes: readonly AppRoute[] = APP_ROUTES;

  it("narrows capabilities and never widens them", () => {
    for (const { capability, onlyRoles = [] } of routes) {
      for (const role of onlyRoles) expect(can(role, capability)).toBe(true);
    }
  });

  it("has no duplicate paths", () => {
    expect(new Set(routes.map(({ path }) => path)).size).toBe(routes.length);
  });

  it("lets everyone open the account page, outside the navigation", () => {
    const account = findRoute("account");
    expect(account?.inNavigation).toBe(false);
    for (const role of ["administrator", "receptionist", "doctor"] as const) {
      expect(account && canOpen(role, account)).toBe(true);
    }
  });

  it("applies onlyRoles", () => {
    const doctors = findRoute("doctors");
    const schedule = findRoute("my/schedule");
    expect(doctors && canOpen("doctor", doctors)).toBe(false);
    expect(doctors && canOpen("receptionist", doctors)).toBe(true);
    expect(schedule && canOpen("administrator", schedule)).toBe(false);
    expect(schedule && canOpen("doctor", schedule)).toBe(true);
  });

  it("doesn't find an unknown path", () => {
    expect(findRoute("nowhere")).toBeUndefined();
    expect(findRoute("my")).toBeUndefined();
  });
});

describe("isSignedInSegment", () => {
  it.each(["dashboard", "account", "patients", "my", "audit"])("%s is", (s) => {
    expect(isSignedInSegment(s)).toBe(true);
  });

  it.each(["sign-in", "missing", "my/queue", "", "design-preview"])(
    "%j isn't",
    (s) => {
      expect(isSignedInSegment(s)).toBe(false);
    },
  );
});

describe("needsDoctorProfile", () => {
  it.each(["dashboard", "my/queue", "my/schedule"])("%s does", (path) => {
    expect(needsDoctorProfile(path)).toBe(true);
  });

  it("the account page doesn't", () => {
    expect(needsDoctorProfile("account")).toBe(false);
  });
});
