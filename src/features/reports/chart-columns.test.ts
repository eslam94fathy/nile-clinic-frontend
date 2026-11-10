import { describe, expect, it } from "vitest";
import { chartColumns } from "./chart-columns";

const day = (date: string, net: string) => ({
  date,
  net,
  received: "0.00",
  refunded: "0.00",
});

describe("chartColumns", () => {
  it("has one column a day, with an empty one for a day the API left out", () => {
    const model = chartColumns({
      from: "2026-11-01",
      to: "2026-11-04",
      byDay: [day("2026-11-02", "100.00"), day("2026-11-04", "50.00")],
    });

    expect(model?.columns.map(({ date, net }) => [date, net])).toEqual([
      ["2026-11-01", null],
      ["2026-11-02", "100.00"],
      ["2026-11-03", null],
      ["2026-11-04", "50.00"],
    ]);
    expect(model?.columns.map(({ share }) => share)).toEqual([0, 1, 0, 0.5]);
    expect(model?.upperShare).toBe(1);
    expect(model?.topLabel).toBe("100.00");
    expect(model?.bottomLabel).toBeNull();
  });

  it("puts negative days below the line, sized on their own side", () => {
    const model = chartColumns({
      from: "2026-11-01",
      to: "2026-11-03",
      byDay: [
        day("2026-11-01", "300.00"),
        day("2026-11-02", "-100.00"),
        day("2026-11-03", "-50.00"),
      ],
    });

    expect(model?.columns.map(({ share, below }) => [share, below])).toEqual([
      [1, false],
      [1, true],
      [0.5, true],
    ]);
    expect(model?.upperShare).toBe(0.75);
    expect(model?.bottomLabel).toBe("-100.00");
  });

  it("works when every day is negative", () => {
    const model = chartColumns({
      from: "2026-11-01",
      to: "2026-11-01",
      byDay: [day("2026-11-01", "-0.50")],
    });
    expect(model?.upperShare).toBe(0);
    expect(model?.columns).toEqual([
      { date: "2026-11-01", net: "-0.50", share: 1, below: true },
    ]);
    expect(model?.topLabel).toBeNull();
  });

  it("tells a piastre apart in a large amount, with no rounding", () => {
    const model = chartColumns({
      from: "2026-11-01",
      to: "2026-11-02",
      byDay: [day("2026-11-01", "1234567.89"), day("2026-11-02", "1234567.88")],
    });
    const [first, second] = model?.columns ?? [];
    expect(first?.share).toBe(1);
    expect(second?.share).toBeLessThan(1);
  });

  it("covers a whole year of 366 days", () => {
    const model = chartColumns({
      from: "2028-01-01",
      to: "2028-12-31",
      byDay: [day("2028-02-29", "10.00"), day("2028-12-31", "20.00")],
    });
    expect(model?.columns).toHaveLength(366);
    expect(model?.columns[59]).toMatchObject({
      date: "2028-02-29",
      share: 0.5,
    });
    expect(model?.columns.at(-1)?.date).toBe("2028-12-31");
  });

  it("draws nothing with no days, or when every net is zero", () => {
    expect(
      chartColumns({ from: "2026-11-01", to: "2026-11-08", byDay: [] }),
    ).toBeNull();
    expect(
      chartColumns({
        from: "2026-11-01",
        to: "2026-11-08",
        byDay: [day("2026-11-02", "0.00")],
      }),
    ).toBeNull();
  });
});
