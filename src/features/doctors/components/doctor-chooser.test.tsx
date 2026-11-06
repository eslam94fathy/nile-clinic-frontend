import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { DoctorChooser } from "./doctor-chooser";

const browserApi = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/browser-api", () => ({ browserApi }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => "/appointments/new",
  useRouter: () => router,
}));

const { doctors: t, shared } = messagesByLocale.en;
const cardiology = {
  id: 1,
  name_en: "Synthetic Cardiology",
  name_ar: "قلب تجريبي",
  is_active: true,
};
const doctor = {
  id: 3,
  name: "Synthetic Doctor",
  title: "Consultant",
  is_active: true,
  specialties: [cardiology],
};
const page = (...rows: (typeof doctor)[]) => ({
  ok: true,
  status: 200,
  data: {
    data: rows,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 15,
      total: rows.length,
      from: rows.length ? 1 : null,
      to: rows.length || null,
    },
  },
});

beforeEach(() => {
  browserApi.mockReset();
  router.refresh.mockReset();
});
afterEach(cleanup);

describe("DoctorChooser", () => {
  it("lists active doctors on opening, once", async () => {
    browserApi.mockResolvedValue(page(doctor));
    renderWithIntl(
      <StrictMode>
        <DoctorChooser specialties={[cardiology]} onChoose={() => {}} />
      </StrictMode>,
    );

    await screen.findByRole("table");
    expect(browserApi).toHaveBeenCalledTimes(1);
    expect(browserApi).toHaveBeenCalledWith("doctors?is_active=1", {
      locale: "en",
    });
  });

  it("leaves name matching to the API, and sends the specialty", async () => {
    browserApi.mockResolvedValue(page(doctor));
    renderWithIntl(
      <DoctorChooser specialties={[cardiology]} onChoose={() => {}} />,
    );
    await screen.findByRole("table");

    fireEvent.change(screen.getByLabelText(t.name), {
      target: { value: "احمد" },
    });
    fireEvent.change(screen.getByLabelText(t.specialty), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: t.chooser.find }));

    await waitFor(() => expect(browserApi).toHaveBeenCalledTimes(2));
    const path = String(browserApi.mock.calls[1]?.[0]);
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("name")).toBe("احمد");
    expect(query.get("specialty_id")).toBe("1");
    expect(query.get("is_active")).toBe("1");
  });

  it("hands back the choice, showing the specialty for the language", async () => {
    browserApi.mockResolvedValue(page(doctor));
    const onChoose = vi.fn();
    renderWithIntl(
      <DoctorChooser specialties={[cardiology]} onChoose={onChoose} />,
    );

    fireEvent.click(
      (
        await screen.findAllByRole("button", {
          name: t.chooser.chooseNamed.replace("{name}", "Synthetic Doctor"),
        })
      )[0] as HTMLElement,
    );
    expect(onChoose).toHaveBeenCalledWith(doctor);
  });

  it("says when nobody matches", async () => {
    browserApi.mockResolvedValue(page());
    renderWithIntl(<DoctorChooser specialties={[]} onChoose={() => {}} />);
    expect(await screen.findByText(t.chooser.emptyTitle)).toBeTruthy();
  });

  it("offers to try again after a failure", async () => {
    browserApi.mockResolvedValueOnce({
      ok: false,
      error: { status: 500, fieldErrors: {}, message: "Failed." },
    });
    browserApi.mockResolvedValueOnce(page(doctor));
    renderWithIntl(<DoctorChooser specialties={[]} onChoose={() => {}} />);

    await screen.findByText("Failed.");
    fireEvent.click(screen.getByRole("button", { name: shared.states.retry }));
    await screen.findByRole("table");
  });

  it("shows the forbidden state on a 403, and lets the gate re-decide", async () => {
    browserApi.mockResolvedValue({
      ok: false,
      error: { status: 403, fieldErrors: {} },
    });
    renderWithIntl(<DoctorChooser specialties={[]} onChoose={() => {}} />);

    await screen.findByText(shared.states.forbiddenHeading);
    expect(router.refresh).toHaveBeenCalled();
  });
});
