import { randomBytes } from "node:crypto";
import {
  adminToken,
  api,
  type LiveAccount,
  type LiveAccounts,
} from "./support";

// Creates this run's synthetic accounts through the API. There's no delete, so teardown deactivates them.
export default async function setup() {
  const token = await adminToken();
  const stamp = Date.now();

  async function createStaff(
    label: string,
    role: "receptionist" | "doctor",
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
  };

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
}
