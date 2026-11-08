import type { Charge, VisitCharge } from "./types";

// Synthetic data for this feature's tests only.

export const SYNTHETIC_DOCTOR = {
  id: 3,
  name: "Synthetic Doctor",
  title: "Consultant",
};
export const SYNTHETIC_PATIENT = {
  id: 12,
  full_name: "Synthetic Patient",
  phone: "01000000001",
};

export function aCharge(changes: Partial<Charge> = {}): Charge {
  return {
    id: 9,
    visit_id: 40,
    status: "unpaid",
    date: "2026-11-08",
    doctor: SYNTHETIC_DOCTOR,
    patient: SYNTHETIC_PATIENT,
    fee: "350.00",
    discount: "0.00",
    amount_due: "350.00",
    amount_paid: "0.00",
    balance: "350.00",
    charged_at: "2026-11-08T08:00:00.000000Z",
    charged_by: { id: 2, name: "Synthetic Reception" },
    discount_reason: null,
    discounted_by: null,
    discounted_at: null,
    cancel_reason: null,
    cancelled_by: null,
    cancelled_at: null,
    payments: [],
    refunds: [],
    ...changes,
  };
}

export function aVisit(changes: Partial<VisitCharge> = {}): VisitCharge {
  return {
    id: 40,
    date: "2026-11-08",
    status: "seen",
    walk_in: false,
    doctor: SYNTHETIC_DOCTOR,
    patient: SYNTHETIC_PATIENT,
    charge_status: "none",
    charge_id: null,
    balance: null,
    ...changes,
  };
}
