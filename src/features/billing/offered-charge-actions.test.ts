import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/auth/permissions";
import { offeredChargeActions } from "./offered-charge-actions";
import type { ChargeStatus } from "./types";

const charge = (
  status: ChargeStatus,
  amount_paid: string,
  balance: string,
) => ({ status, amount_paid, balance });

const offered = (
  role: Role,
  status: ChargeStatus,
  paid: string,
  balance: string,
) => offeredChargeActions(charge(status, paid, balance), role);

describe("offeredChargeActions", () => {
  it("offers an administrator everything an unpaid charge allows", () => {
    expect(offered("administrator", "unpaid", "0.00", "350.00")).toEqual([
      "pay",
      "cancel",
      "discount",
    ]);
  });

  it("offers a receptionist payment and cancelling only", () => {
    expect(offered("receptionist", "unpaid", "0.00", "350.00")).toEqual([
      "pay",
      "cancel",
    ]);
  });

  it("offers a refund, not cancelling, once money is held", () => {
    expect(
      offered("administrator", "partially_paid", "150.00", "200.00"),
    ).toEqual(["pay", "discount", "refund"]);
    expect(
      offered("receptionist", "partially_paid", "150.00", "200.00"),
    ).toEqual(["pay"]);
  });

  it("offers no payment when nothing is owed", () => {
    expect(offered("administrator", "paid", "350.00", "0.00")).toEqual([
      "discount",
      "refund",
    ]);
    expect(offered("receptionist", "paid", "350.00", "0.00")).toEqual([]);
  });

  it("offers cancelling a charge paid only by a whole-fee discount, as nothing is held", () => {
    expect(offered("administrator", "paid", "0.00", "0.00")).toEqual([
      "cancel",
      "discount",
    ]);
    expect(offered("receptionist", "paid", "0.00", "0.00")).toEqual(["cancel"]);
  });

  it.each(["administrator", "receptionist", "doctor"] as const)(
    "offers %s nothing on a cancelled charge",
    (role) => {
      expect(offered(role, "cancelled", "0.00", "350.00")).toEqual([]);
    },
  );

  it("offers a doctor nothing at all", () => {
    expect(offered("doctor", "unpaid", "0.00", "350.00")).toEqual([]);
    expect(offered("doctor", "partially_paid", "1.00", "2.00")).toEqual([]);
  });

  it("decides by amount, not by how the text is written", () => {
    expect(offered("receptionist", "unpaid", "0.00", "0.01")).toEqual([
      "pay",
      "cancel",
    ]);
    expect(offered("administrator", "partially_paid", "0.01", "9.99")).toEqual([
      "pay",
      "discount",
      "refund",
    ]);
  });
});
