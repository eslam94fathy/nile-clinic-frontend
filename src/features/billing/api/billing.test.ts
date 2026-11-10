import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelCharge,
  chargeVisit,
  readVisits,
  recordPayment,
  recordRefund,
  setDiscount,
} from "./billing";

const { browserApi } = vi.hoisted(() => ({ browserApi: vi.fn() }));
vi.mock("@/lib/api/browser-api", () => ({ browserApi }));

const doctor = { id: 3, name: "Synthetic Doctor", title: "Consultant" };
const patient = {
  id: 12,
  full_name: "Synthetic Patient",
  phone: "01000000001",
};
const visit = {
  id: 40,
  date: "2026-11-08",
  status: "seen",
  walk_in: true,
  doctor,
  patient,
  charge_status: "none",
  charge_id: null,
  balance: null,
};
const charge = {
  id: 9,
  visit_id: 40,
  status: "unpaid",
  date: "2026-11-08",
  doctor,
  patient,
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
};
const meta = {
  current_page: 1,
  last_page: 1,
  per_page: 100,
  total: 1,
  from: 1,
  to: 1,
};
const answer = (data: unknown, status = 200) => ({ ok: true, status, data });
const refused = {
  ok: false,
  error: { status: 422, fieldErrors: { amount: ["Refused."] } },
};
const ANY_DAY = {
  date: "2026-11-08",
  doctorId: null,
  chargeStatus: null,
  page: 1,
};

beforeEach(() => browserApi.mockReset());

describe("readVisits", () => {
  it("reads a date at the largest page, sending only the filters set", async () => {
    browserApi.mockResolvedValue(answer({ data: [visit], meta }));

    const result = await readVisits(ANY_DAY, "ar");

    expect(browserApi).toHaveBeenCalledWith(
      "visits?date=2026-11-08&page=1&per_page=100",
      { locale: "ar" },
    );
    expect(result.ok && result.data.data[0]?.id).toBe(40);
  });

  it("sends a doctor and a charge status", async () => {
    browserApi.mockResolvedValue(answer({ data: [], meta }));

    await readVisits(
      { date: "2026-11-01", doctorId: 3, chargeStatus: "none", page: 2 },
      "en",
    );

    expect(browserApi).toHaveBeenCalledWith(
      "visits?date=2026-11-01&doctor_id=3&charge_status=none&page=2&per_page=100",
      { locale: "en" },
    );
  });

  it("treats a body that isn't the contract's as a failed read", async () => {
    browserApi.mockResolvedValue(
      answer({ data: [{ ...visit, balance: 350 }], meta }),
    );

    expect((await readVisits(ANY_DAY, "en")).ok).toBe(false);
  });
});

describe("changes", () => {
  it("charges a visit with no body, and gives the charge", async () => {
    browserApi.mockResolvedValue(answer({ data: charge }, 201));

    const result = await chargeVisit(40, "en");

    expect(browserApi).toHaveBeenCalledWith("visits/40/charge", {
      method: "POST",
      locale: "en",
    });
    expect(result.ok && result.data.fee).toBe("350.00");
  });

  it("records a payment with the amount as text", async () => {
    browserApi.mockResolvedValue(answer({ data: charge }, 201));

    await recordPayment(9, { amount: "150.50", method: "cash" }, "ar");

    expect(browserApi).toHaveBeenCalledWith("charges/9/payments", {
      method: "POST",
      json: { amount: "150.50", method: "cash" },
      locale: "ar",
    });
  });

  it("records a refund with its reason", async () => {
    browserApi.mockResolvedValue(answer({ data: charge }, 201));

    await recordRefund(
      9,
      { amount: "50", method: "card", reason: "Synthetic overpayment" },
      "en",
    );

    expect(browserApi).toHaveBeenCalledWith("charges/9/refunds", {
      method: "POST",
      json: { amount: "50", method: "card", reason: "Synthetic overpayment" },
      locale: "en",
    });
  });

  it("sets a discount with PUT", async () => {
    browserApi.mockResolvedValue(answer({ data: charge }));

    await setDiscount(9, { amount: "0", reason: "Synthetic removal" }, "en");

    expect(browserApi).toHaveBeenCalledWith("charges/9/discount", {
      method: "PUT",
      json: { amount: "0", reason: "Synthetic removal" },
      locale: "en",
    });
  });

  it("cancels with a reason", async () => {
    browserApi.mockResolvedValue(
      answer({ data: { ...charge, status: "cancelled" } }),
    );

    const result = await cancelCharge(9, { reason: "Synthetic mistake" }, "en");

    expect(browserApi).toHaveBeenCalledWith("charges/9/cancel", {
      method: "POST",
      json: { reason: "Synthetic mistake" },
      locale: "en",
    });
    expect(result.ok && result.data.status).toBe("cancelled");
  });

  it("passes a refusal through, and calls once", async () => {
    browserApi.mockResolvedValue(refused);

    const result = await recordPayment(
      9,
      { amount: "999", method: "cash" },
      "en",
    );

    expect(result).toEqual(refused);
    expect(browserApi).toHaveBeenCalledTimes(1);
  });

  it("calls once when no answer arrives", async () => {
    browserApi.mockResolvedValue({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });

    const result = await recordPayment(
      9,
      { amount: "1", method: "wallet" },
      "en",
    );

    expect(!result.ok && result.error.status).toBe(0);
    expect(browserApi).toHaveBeenCalledTimes(1);
  });

  it("reports a change whose answer doesn't match the contract as having no usable answer", async () => {
    browserApi.mockResolvedValue(
      answer({ data: { ...charge, fee: 350 } }, 201),
    );

    const result = await recordPayment(
      9,
      { amount: "1", method: "cash" },
      "en",
    );

    expect(!result.ok && result.error.status).toBe(0);
    expect(browserApi).toHaveBeenCalledTimes(1);
  });
});
