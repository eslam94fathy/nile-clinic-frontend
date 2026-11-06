import { type Capability, can, type Role } from "./permissions";

export type AppRoute = {
  path: string;
  capability: Capability;
  /** Narrows the capability, where the blueprint offers a screen to fewer roles than the API allows. */
  onlyRoles?: readonly Role[];
  /** Under `shell.nav` in the messages. */
  labelKey: string;
  inNavigation: boolean;
  /** When false, the catch-all route shows "not available yet". A later phase adds the page and sets this. */
  built: boolean;
};

/** Every signed-in destination, in navigation order. See docs/frontend-blueprint.md. */
export const APP_ROUTES = [
  {
    path: "dashboard",
    capability: "ownAccount",
    labelKey: "dashboard",
    inNavigation: true,
    built: true,
  },
  {
    path: "patients",
    capability: "managePatients",
    labelKey: "patients",
    inNavigation: true,
    built: false,
  },
  {
    path: "appointments",
    capability: "manageAppointments",
    labelKey: "appointments",
    inNavigation: true,
    built: false,
  },
  {
    path: "queue",
    capability: "manageQueue",
    labelKey: "queue",
    inNavigation: true,
    built: false,
  },
  {
    path: "billing",
    capability: "billing",
    labelKey: "billing",
    inNavigation: true,
    built: false,
  },
  {
    path: "charges",
    capability: "billing",
    labelKey: "charges",
    inNavigation: true,
    built: false,
  },
  {
    path: "doctors",
    capability: "readDoctors",
    onlyRoles: ["administrator", "receptionist"],
    labelKey: "doctors",
    inNavigation: true,
    built: false,
  },
  {
    path: "specialties",
    capability: "manageDoctors",
    labelKey: "specialties",
    inNavigation: true,
    built: false,
  },
  {
    path: "fees",
    capability: "readFees",
    labelKey: "fees",
    inNavigation: true,
    built: false,
  },
  {
    path: "staff",
    capability: "manageStaff",
    labelKey: "staff",
    inNavigation: true,
    built: false,
  },
  {
    path: "reports",
    capability: "reports",
    labelKey: "reports",
    inNavigation: true,
    built: false,
  },
  {
    path: "audit",
    capability: "auditTrail",
    labelKey: "audit",
    inNavigation: true,
    built: false,
  },
  {
    path: "my/queue",
    capability: "ownQueue",
    labelKey: "myQueue",
    inNavigation: true,
    built: false,
  },
  {
    path: "my/appointments",
    capability: "readOwnAppointments",
    labelKey: "myAppointments",
    inNavigation: true,
    built: false,
  },
  {
    path: "my/visits",
    capability: "medicalRecords",
    labelKey: "myVisits",
    inNavigation: true,
    built: false,
  },
  {
    path: "my/schedule",
    capability: "readSchedules",
    onlyRoles: ["doctor"],
    labelKey: "mySchedule",
    inNavigation: true,
    built: false,
  },
  {
    path: "account",
    capability: "ownAccount",
    labelKey: "account",
    inNavigation: false,
    built: true,
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
