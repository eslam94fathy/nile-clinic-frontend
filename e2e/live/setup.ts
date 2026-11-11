import { randomBytes } from "node:crypto";
import {
  adminToken,
  api,
  type LiveAccount,
  type LiveAccounts,
  type LiveDoctors,
} from "./support";

// Creates this run's synthetic accounts through the API. There's no delete, so teardown deactivates them.
export default async function setup() {
  const token = await adminToken();
  const stamp = Date.now();

  async function createStaff(
    label: string,
    role: "administrator" | "receptionist" | "doctor",
  ): Promise<LiveAccount> {
    const email = `synthetic.live.${label}.${stamp}@example.test`;
    const password = `Synthetic-${randomBytes(12).toString("hex")}`;
    const response = await api("staff", {
      method: "POST",
      token,
      body: {
        name: `Synthetic Live ${label}`,
        email,
        role,
        password,
        password_confirmation: password,
      },
    });
    if (response.status !== 201) {
      throw new Error(`Creating ${label} gave status ${response.status}.`);
    }
    const { data } = (await response.json()) as { data: { id: number } };
    return { id: data.id, email, password };
  }

  const specialty = await api("specialties", {
    method: "POST",
    token,
    body: {
      name_en: `Synthetic Specialty ${stamp}`,
      name_ar: `تخصص تجريبي ${stamp}`,
    },
  });
  if (specialty.status !== 201) {
    throw new Error(`Creating a specialty gave status ${specialty.status}.`);
  }
  const specialtyId = ((await specialty.json()) as { data: { id: number } })
    .data.id;

  const accounts: LiveAccounts = {
    receptionist: await createStaff("receptionist", "receptionist"),
    doctor: await createStaff("doctor", "doctor"),
    newDoctor: await createStaff("newdoctor", "doctor"),
    disposable: await createStaff("disposable", "receptionist"),
    passwordChange: await createStaff("passwordchange", "receptionist"),
    // Unique names, so that a test can find this run's doctor among any left by a run that was interrupted.
    bookingDoctor: await createStaff(`bookingdoctor${stamp}`, "doctor"),
    secondDoctor: await createStaff(`seconddoctor${stamp}`, "doctor"),
    noShowDoctor: await createStaff(`noshowdoctor${stamp}`, "doctor"),
    queueDoctor: await createStaff(`queuedoctor${stamp}`, "doctor"),
    secondQueueDoctor: await createStaff(`secondqueue${stamp}`, "doctor"),
    encounterDoctor: await createStaff(`encounterdoctor${stamp}`, "doctor"),
    secondEncounterDoctor: await createStaff(
      `secondencounter${stamp}`,
      "doctor",
    ),
    billingDoctor: await createStaff(`billingdoctor${stamp}`, "doctor"),
    auditAdmin: await createStaff("auditadmin", "administrator"),
  };

  async function createDoctor(account: LiveAccount): Promise<number> {
    const response = await api("doctors", {
      method: "POST",
      token,
      body: {
        user_id: account.id,
        title: "Dr",
        specialty_ids: [specialtyId],
      },
    });
    if (response.status !== 201) {
      throw new Error(`Creating a doctor gave status ${response.status}.`);
    }
    return ((await response.json()) as { data: { id: number } }).data.id;
  }

  // Hours on every day, so that free times exist whatever day the suite runs.
  async function setHours(
    doctorId: number,
    { minutes = 20, start = "09:00", end = "17:00" } = {},
  ) {
    const response = await api(`doctors/${doctorId}/schedule`, {
      method: "PUT",
      token,
      body: {
        appointment_minutes: minutes,
        periods: [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ].map((day) => ({ day, start, end })),
      },
    });
    if (response.status !== 200) {
      throw new Error(`Setting hours gave status ${response.status}.`);
    }
  }

  const doctors: LiveDoctors = {
    booking: await createDoctor(accounts.bookingDoctor),
    second: await createDoctor(accounts.secondDoctor),
    noShow: await createDoctor(accounts.noShowDoctor),
    queue: await createDoctor(accounts.queueDoctor),
    secondQueue: await createDoctor(accounts.secondQueueDoctor),
    encounter: await createDoctor(accounts.encounterDoctor),
    secondEncounter: await createDoctor(accounts.secondEncounterDoctor),
    billing: await createDoctor(accounts.billingDoctor),
    bookingName: `Synthetic Live bookingdoctor${stamp}`,
    secondName: `Synthetic Live seconddoctor${stamp}`,
    queueName: `Synthetic Live queuedoctor${stamp}`,
    secondQueueName: `Synthetic Live secondqueue${stamp}`,
    billingName: `Synthetic Live billingdoctor${stamp}`,
    billingFee: "350.00",
  };
  await setHours(doctors.booking);
  await setHours(doctors.second);
  // Check-in needs an appointment today, so these have free times whatever hour the suite runs.
  const allDay = { minutes: 5, start: "00:00", end: "24:00" };
  await setHours(doctors.queue, allDay);
  await setHours(doctors.secondQueue, allDay);
  await setHours(doctors.encounter, allDay);
  await setHours(doctors.secondEncounter, allDay);
  await setHours(doctors.billing, allDay);

  const fee = await api(`doctors/${doctors.billing}/fee`, {
    method: "PUT",
    token,
    body: { amount: doctors.billingFee },
  });
  if (fee.status !== 200) {
    throw new Error(`Setting a fee gave status ${fee.status}.`);
  }

  const profile = await api("doctors", {
    method: "POST",
    token,
    body: {
      user_id: accounts.doctor.id,
      title: "Dr",
      specialty_ids: [specialtyId],
    },
  });
  if (profile.status !== 201) {
    throw new Error(`Creating a doctor profile gave status ${profile.status}.`);
  }

  await api("auth/sign-out", { method: "POST", token });

  process.env.LIVE_ACCOUNTS = JSON.stringify(accounts);
  process.env.LIVE_SPECIALTY_ID = String(specialtyId);
  process.env.LIVE_DOCTORS = JSON.stringify(doctors);
}
