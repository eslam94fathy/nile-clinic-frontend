import type { components } from "@/lib/api/generated/patients";

export type PatientSummary = components["schemas"]["PatientSummary"];
export type Patient = components["schemas"]["Patient"];
export type EmergencyContact = components["schemas"]["EmergencyContact"];
export type PatientInput = components["schemas"]["PatientInput"];
export type PatientChanges = Partial<PatientInput>;
export type Sex = components["schemas"]["Sex"];

/** Empty means not searched by. All are private: they never go in the page's address (constitution II). */
export type PatientSearchTerms = {
  name: string;
  phone: string;
  id: string;
  national_id: string;
};
