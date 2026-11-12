import { type Capability, can, type Role } from "./permissions";

export type AppRoute = {
  path: string;
  capability: Capability;
  /** Narrows the capability, where the blueprint offers a screen to fewer roles than the API allows. */
  onlyRoles?: readonly Role[];
  /** Under `shell.nav` in the messages. */
  labelKey: string;
  inNavigation: boolean;
};

/** Every signed-in destination, in navigation order. See docs/frontend-blueprint.md. */
export const APP_ROUTES = [
  {
    path: "dashboard",
    capability: "ownAccount",
    labelKey: "dashboard",
    inNavigation: true,
  },
  {
    path: "patients",
    capability: "managePatients",
    labelKey: "patients",
    inNavigation: true,
  },
  {
    path: "appointments",
    capability: "manageAppointments",
    labelKey: "appointments",
    inNavigation: true,
  },
  {
    path: "queue",
    capability: "manageQueue",
    labelKey: "queue",
    inNavigation: true,
  },
  {
    path: "billing",
    capability: "billing",
    labelKey: "billing",
    inNavigation: true,
  },
  {
    path: "charges",
    capability: "billing",
    labelKey: "charges",
    inNavigation: true,
  },
  {
    path: "doctors",
    capability: "readDoctors",
    onlyRoles: ["administrator", "receptionist"],
    labelKey: "doctors",
    inNavigation: true,
  },
  {
    path: "specialties",
    capability: "manageDoctors",
    labelKey: "specialties",
    inNavigation: true,
  },
  {
    path: "fees",
    capability: "readFees",
    labelKey: "fees",
    inNavigation: true,
  },
  {
    path: "staff",
    capability: "manageStaff",
    labelKey: "staff",
    inNavigation: true,
  },
  {
    path: "reports",
    capability: "reports",
    labelKey: "reports",
    inNavigation: true,
  },
  {
    path: "audit",
    capability: "auditTrail",
    labelKey: "audit",
    inNavigation: true,
  },
  {
    path: "my/queue",
    capability: "ownQueue",
    labelKey: "myQueue",
    inNavigation: true,
  },
  {
    path: "my/appointments",
    capability: "readOwnAppointments",
    labelKey: "myAppointments",
    inNavigation: true,
  },
  {
    path: "my/visits",
    capability: "medicalRecords",
    labelKey: "myVisits",
    inNavigation: true,
  },
  {
    path: "my/encounters",
    capability: "medicalRecords",
    labelKey: "myVisits",
    inNavigation: false,
  },
  {
    path: "my/patients",
    capability: "medicalRecords",
    labelKey: "myVisits",
    inNavigation: false,
  },
  {
    path: "my/schedule",
    capability: "readSchedules",
    onlyRoles: ["doctor"],
    labelKey: "mySchedule",
    inNavigation: true,
  },
  {
    path: "account",
    capability: "ownAccount",
    labelKey: "account",
    inNavigation: false,
  },
] as const satisfies readonly AppRoute[];

export type AppPath = (typeof APP_ROUTES)[number]["path"];

export function findRoute(path: string) {
  return APP_ROUTES.find((route) => route.path === path);
}

export function canOpen(role: Role, route: AppRoute): boolean {
  return (
    can(role, route.capability) &&
    (route.onlyRoles === undefined || route.onlyRoles.includes(role))
  );
}

export function navigationFor(role: Role): AppRoute[] {
  return APP_ROUTES.filter(
    (route) => route.inNavigation && canOpen(role, route),
  );
}

/** Whether a doctor needs a doctor profile for this screen. The account page always works. */
export function needsDoctorProfile(path: string): boolean {
  return path === "dashboard" || path.startsWith("my/");
}

const SIGNED_IN_SEGMENTS = new Set<string>(
  APP_ROUTES.map(({ path }) => path.split("/")[0] ?? path),
);

/** Tells the proxy whether an address's first segment is a signed-in area, rather than unknown. */
export function isSignedInSegment(segment: string): boolean {
  return SIGNED_IN_SEGMENTS.has(segment);
}
