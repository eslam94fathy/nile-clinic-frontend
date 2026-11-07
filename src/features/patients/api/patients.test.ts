import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findByPhone,
  findPatientById,
  readPatient,
  registerPatient,
  searchPatients,
  updatePatient,
} from "./patients";

const browserApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/browser-api", () => ({ browserApi }));

const summary = {
  id: 5,
  full_name: "Synthetic Patient",
  sex: "male",
  date_of_birth: "1990-04-12",
  phone: "01000000001",
};
const record = {
  ...summary,
  national_id: null,
  address: null,
  emergency_contact: null,
  created_at: "2026-02-01T10:00:00.000000Z",
  updated_at: "2026-02-01T10:00:00.000000Z",
};
const meta = {
  current_page: 1,
  last_page: 1,
  per_page: 15,
  total: 1,
  from: 1,
  to: 1,
};
const answer = (data: unknown) => ({ ok: true, status: 200, data });

beforeEach(() => browserApi.mockReset());

describe("findPatientById", () => {
  it("uses the list, which isn't audited, and never the record", async () => {
    browserApi.mockResolvedValue(answer({ data: [summary], meta }));

    const result = await findPatientById(5, "en");

    expect(browserApi).toHaveBeenCalledWith("patients?id=5", { locale: "en" });
    expect(result.ok && result.data.data[0]?.id).toBe(5);
  });
});

describe("searchPatients", () => {
  it("leaves blank terms out, and asks for the page", async () => {
    browserApi.mockResolvedValue(answer({ data: [summary], meta }));

    const result = await searchPatients(
      { name: "أحمد", phone: "", id: "", national_id: "" },
      2,
      "ar",
    );

    expect(browserApi).toHaveBeenCalledWith(
      `patients?name=${encodeURIComponent("أحمد")}&page=2`,
      { locale: "ar" },
    );
    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { data: [summary], meta },
    });
  });

  it("gives a failed result for an answer of the wrong shape", async () => {
    browserApi.mockResolvedValue(answer({ nonsense: true }));

    const result = await searchPatients(
      { name: "x", phone: "", id: "", national_id: "" },
      1,
      "en",
    );

    expect(result).toEqual({
      ok: false,
      error: { status: 0, fieldErrors: {} },
    });
  });

  it("passes the API's refusal on", async () => {
    const error = { status: 422, fieldErrors: { phone: ["Bad."] } };
    browserApi.mockResolvedValue({ ok: false, error });

    expect(
      await searchPatients(
        { name: "", phone: "1", id: "", national_id: "" },
        1,
        "en",
      ),
    ).toEqual({ ok: false, error });
  });
});

describe("findByPhone", () => {
  it("asks for ten", async () => {
    browserApi.mockResolvedValue(answer({ data: [], meta }));
    await findByPhone("+201000000001", "en");

    expect(browserApi).toHaveBeenCalledWith(
      "patients?phone=%2B201000000001&per_page=10",
      { locale: "en" },
    );
  });
});

describe("readPatient", () => {
  it("reads once, and unwraps the record", async () => {
    browserApi.mockResolvedValue(answer({ data: record }));

    expect(await readPatient(5, "en")).toEqual({
      ok: true,
      status: 200,
      data: record,
    });
    expect(browserApi).toHaveBeenCalledTimes(1);
    expect(browserApi).toHaveBeenCalledWith("patients/5", { locale: "en" });
  });
});

describe("changes", () => {
  it("registers with POST, and unwraps the record", async () => {
    browserApi.mockResolvedValue(answer({ data: record }));
    const body = {
      full_name: "Synthetic Patient",
      date_of_birth: "1990-04-12",
      sex: "male" as const,
      phone: "01000000001",
    };

    expect(await registerPatient(body, "en")).toEqual({
      ok: true,
      status: 200,
      data: record,
    });
    expect(browserApi).toHaveBeenCalledWith("patients", {
      method: "POST",
      json: body,
      locale: "en",
    });
  });

  it("updates with PATCH, and unwraps the record", async () => {
    browserApi.mockResolvedValue(answer({ data: record }));

    expect(await updatePatient(5, { address: null }, "en")).toEqual({
      ok: true,
      status: 200,
      data: record,
    });
    expect(browserApi).toHaveBeenCalledWith("patients/5", {
      method: "PATCH",
      json: { address: null },
      locale: "en",
    });
  });
});
