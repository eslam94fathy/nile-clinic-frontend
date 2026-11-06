import {
  normalizeNationalId,
  normalizePhone,
  type PatientFormValues,
} from "./schemas/patient";
import type {
  EmergencyContact,
  Patient,
  PatientChanges,
  PatientInput,
} from "./types";

export function recordToForm(record: Patient): PatientFormValues {
  return {
    full_name: record.full_name,
    date_of_birth: record.date_of_birth,
    sex: record.sex,
    phone: record.phone,
    national_id: record.national_id ?? "",
    address: record.address ?? "",
    emergency_contact: record.emergency_contact ?? {
      name: "",
      relationship: "",
      phone: "",
    },
  };
}

function normalizedContact(contact: EmergencyContact): EmergencyContact {
  return {
    name: contact.name.trim(),
    relationship: contact.relationship.trim(),
    phone: normalizePhone(contact.phone),
  };
}

function isBlank({ name, relationship, phone }: EmergencyContact): boolean {
  return name === "" && relationship === "" && phone === "";
}

function sameContact(a: EmergencyContact, b: EmergencyContact): boolean {
  return (
    a.name === b.name &&
    a.relationship === b.relationship &&
    a.phone === b.phone
  );
}

export function toRegisterBody(values: PatientFormValues): PatientInput {
  const nationalId = normalizeNationalId(values.national_id);
  const address = values.address.trim();
  const contact = normalizedContact(values.emergency_contact);

  return {
    full_name: values.full_name.trim(),
    date_of_birth: values.date_of_birth,
    sex: values.sex,
    phone: normalizePhone(values.phone),
    ...(nationalId === "" ? {} : { national_id: nationalId }),
    ...(address === "" ? {} : { address }),
    ...(isBlank(contact) ? {} : { emergency_contact: contact }),
  };
}

function contactChange(
  typed: EmergencyContact,
  stored: EmergencyContact | null,
): Pick<PatientChanges, "emergency_contact"> {
  const contact = normalizedContact(typed);

  if (isBlank(contact))
    return stored === null ? {} : { emergency_contact: null };
  return stored !== null && sameContact(contact, stored)
    ? {}
    : { emergency_contact: contact };
}

/**
 * Only what differs, so that one person's save overwrites as little as possible of another's. An empty
 * result must send nothing at all: the API records a `PATCH` that changes nothing as an opening.
 */
export function toChanges(
  values: PatientFormValues,
  record: Patient,
): PatientChanges {
  // The API collapses inner spaces in a name, so a difference only in those is no change (`ArabicName::clean`).
  const fullName = values.full_name.trim().replace(/\s+/gu, " ");
  const phone = normalizePhone(values.phone);
  const nationalId = normalizeNationalId(values.national_id);
  const address = values.address.trim();

  return {
    ...(fullName === record.full_name ? {} : { full_name: fullName }),
    ...(values.date_of_birth === record.date_of_birth
      ? {}
      : { date_of_birth: values.date_of_birth }),
    ...(values.sex === record.sex ? {} : { sex: values.sex }),
    ...(phone === record.phone ? {} : { phone }),
    ...(nationalId === (record.national_id ?? "")
      ? {}
      : { national_id: nationalId === "" ? null : nationalId }),
    ...(address === (record.address ?? "")
      ? {}
      : { address: address === "" ? null : address }),
    ...contactChange(values.emergency_contact, record.emergency_contact),
  };
}

/**
 * What the person changed since the form opened. A colleague's save may have arrived underneath, and a field
 * this person never touched still shows the older value, which must not undo theirs. Anything already matching
 * the newest record is left out too, as sending it would write a false opening if nothing else changed.
 */
export function toChangesSince(
  values: PatientFormValues,
  opened: Patient,
  latest: Patient,
): PatientChanges {
  const changedByThisPerson = toChanges(values, opened);
  return Object.fromEntries(
    Object.entries(toChanges(values, latest)).filter(
      ([field]) => field in changedByThisPerson,
    ),
  );
}
