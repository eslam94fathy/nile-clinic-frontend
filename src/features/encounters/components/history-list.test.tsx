import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { pageOf } from "../test-support";
import { HistoryList } from "./history-list";

afterEach(cleanup);

const t = messagesByLocale.en.encounters.history;
const item = {
  id: 9,
  date: "2026-01-15",
  doctor: {
    id: 2,
    name: "Synthetic Doctor",
    specialties: [
      { id: 1, name_en: "Cardiology", name_ar: "قلب", is_active: true },
    ],
  },
};

function show(
  page = pageOf([item]),
  locale: "en" | "ar" = "en",
  onPage = vi.fn(),
) {
  renderWithIntl(
    <HistoryList
      items={page.data}
      meta={page.meta}
      reading={false}
      onPage={onPage}
      renderOpen={() => <button type="button">Open it</button>}
    />,
    locale,
  );
  return onPage;
}

describe("HistoryList", () => {
  it("shows a date, a doctor, and specialties", () => {
    show();
    expect(screen.getByText("Synthetic Doctor")).not.toBeNull();
    expect(screen.getByText("Cardiology")).not.toBeNull();
    expect(document.body.textContent).toContain("2026");
  });

  it("uses the current language for specialties", () => {
    show(pageOf([item]), "ar");
    expect(screen.getByText("قلب")).not.toBeNull();
  });

  it("uses neutral words when there's nothing", () => {
    show(pageOf([]));
    expect(screen.getByText(t.emptyTitle)).not.toBeNull();
  });

  it("offers no paging for one page", () => {
    show();
    expect(screen.queryByRole("button", { name: t.next })).toBeNull();
  });

  it("asks for further pages only when pressed", () => {
    const onPage = show(pageOf([item], 2, 3));
    expect(onPage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: t.next }));
    expect(onPage).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: t.previous }));
    expect(onPage).toHaveBeenLastCalledWith(1);
  });
});
