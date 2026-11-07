import type { Encounter } from "./types";

/** A synthetic draft, for this feature's tests. */
export const draft: Encounter = {
  id: 3,
  visit_id: 7,
  status: "draft",
  date: "2026-11-07",
  doctor: { id: 2, name: "Synthetic Doctor", title: "Consultant" },
  patient: {
    id: 21,
    full_name: "Synthetic Patient",
    sex: "female",
    date_of_birth: "1990-01-01",
  },
  chief_complaint: "Synthetic complaint",
  examination_findings: null,
  diagnosis: null,
  treatment_plan: null,
  prescriptions: [],
  addenda: [],
  started_at: "2026-11-07T08:00:00.000000Z",
  last_saved_at: "2026-11-07T08:30:00.000000Z",
  finalized_at: null,
};

export const finalized: Encounter = {
  ...draft,
  status: "finalized",
  diagnosis: "Synthetic diagnosis",
  finalized_at: "2026-11-07T09:00:00.000000Z",
};

export const ok = <Data>(data: Data, status = 200) => ({
  ok: true as const,
  status,
  data,
});

export const refused = (
  status: number,
  fieldErrors: Record<string, string[]> = {},
  message?: string,
) => ({
  ok: false as const,
  error: { status, fieldErrors, ...(message ? { message } : {}) },
});

export const pageOf = <Item>(data: Item[], currentPage = 1, lastPage = 1) => ({
  data,
  meta: {
    current_page: currentPage,
    last_page: lastPage,
    per_page: 15,
    total: data.length,
    from: data.length ? 1 : null,
    to: data.length || null,
  },
});
