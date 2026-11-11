import { describe, expect, it } from "vitest";
import { dashboardLinks as links } from "./links";

const TODAY = "2026-11-11";

describe("dashboardLinks", () => {
  it("opens each screen with the filter its figure counts", () => {
    expect(links.appointmentsToArrive).toBe("/appointments?status=scheduled");
    expect(links.appointmentsToMove).toBe(
      "/appointments?outside_availability=1",
    );
    expect(links.appointment(7)).toBe("/appointments/7");
    expect(links.queueByStatus("with_doctor")).toBe(
      "/queue?status=with_doctor",
    );
    expect(links.billingByStatus("none")).toBe("/billing?charge_status=none");
    expect(links.billingByStatus("partially_paid")).toBe(
      "/billing?charge_status=partially_paid",
    );
    expect(links.ownAppointmentsToArrive).toBe(
      "/my/appointments?status=scheduled",
    );
    expect(links.ownAppointment(9)).toBe("/my/appointments/9");
    expect(links.ownVisits("2026-08-12", TODAY, "draft")).toBe(
      "/my/visits?from=2026-08-12&to=2026-11-11&record_status=draft",
    );
    expect(links.moneyCollectedToday(TODAY)).toBe(
      "/reports/money-collected?from=2026-11-11&to=2026-11-11",
    );
    expect(links.activityToday(TODAY)).toBe(
      "/reports/activity?from=2026-11-11&to=2026-11-11",
    );
  });

  it("never leads to a patient's record or a medical record", () => {
    const addresses = [
      links.appointmentsToArrive,
      links.appointmentsToMove,
      links.appointment(1),
      links.queue,
      links.queueByStatus("waiting"),
      links.billing,
      links.billingByStatus("unpaid"),
      links.ownQueue,
      links.ownAppointmentsToArrive,
      links.ownAppointment(1),
      links.ownVisits(TODAY, TODAY, "none"),
      links.moneyCollectedToday(TODAY),
      links.activityToday(TODAY),
    ];
    for (const address of addresses) {
      expect(address).not.toMatch(
        /^\/(patients|my\/encounters|my\/patients|audit)/,
      );
    }
  });
});
