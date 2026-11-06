import type { components } from "@/lib/api/generated/staff-auth";

export type Role = components["schemas"]["Role"];

/**
 * The one role map, transcribed from the backend's policies. A test compares each cell with the matrix
 * in docs/backend-integration.md. This decides what's shown, and is never a security decision: the API
 * decides, and its `403` wins over anything here.
 */
export const ROLE_CAPABILITIES = {
  ownAccount: ["administrator", "receptionist", "doctor"],
  manageStaff: ["administrator"],
  readDoctors: ["administrator", "receptionist", "doctor"],
  manageDoctors: ["administrator"],
  readSchedules: ["administrator", "receptionist", "doctor"],
  manageSchedules: ["administrator"],
  managePatients: ["administrator", "receptionist"],
  manageAppointments: ["administrator", "receptionist"],
  readOwnAppointments: ["doctor"],
  manageQueue: ["administrator", "receptionist"],
  ownQueue: ["doctor"],
  medicalRecords: ["doctor"],
  readFees: ["administrator", "receptionist"],
  setFees: ["administrator"],
  billing: ["administrator", "receptionist"],
  discountAndRefund: ["administrator"],
  reports: ["administrator"],
  auditTrail: ["administrator"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof ROLE_CAPABILITIES;

export function can(role: Role, capability: Capability): boolean {
  const roles: readonly Role[] = ROLE_CAPABILITIES[capability];
  return roles.includes(role);
}
