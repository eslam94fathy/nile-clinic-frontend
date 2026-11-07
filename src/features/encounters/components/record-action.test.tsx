import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { recordOpening } from "../opening";
import { draft, ok, refused } from "../test-support";
import { RecordAction } from "./record-action";

const startEncounter = vi.hoisted(() => vi.fn());
vi.mock("../api/encounters", () => ({ startEncounter }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/i18n/navigation", async (original) => ({
  ...(await original<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => router,
}));

const t = messagesByLocale.en.encounters.actions;
const start = () =>
  fireEvent.click(screen.getByRole("button", { name: t.start }));

beforeEach(() => {
  startEncounter.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
});
afterEach(cleanup);

describe("RecordAction", () => {
  it("starts in one click, with no dialog, and shows the answer with no read", async () => {
    startEncounter.mockResolvedValue(ok(draft, 201));
    renderWithIntl(
      <RecordAction visitId={7} status="none" encounterId={null} />,
    );
    start();

    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/my/encounters/${draft.id}`),
    );
    expect(startEncounter).toHaveBeenCalledWith(7, "en");
    expect(recordOpening.takeHandedOver(draft.id)).toBe(draft);
  });

  it("can't start twice at once", async () => {
    startEncounter.mockReturnValue(new Promise(() => {}));
    renderWithIntl(
      <RecordAction visitId={7} status="none" encounterId={null} />,
    );
    start();
    fireEvent.click(await screen.findByRole("button", { name: t.starting }));
    expect(startEncounter).toHaveBeenCalledOnce();
  });

  it("shows a refusal and reads the list again, comparing no message text", async () => {
    startEncounter.mockResolvedValue(
      refused(422, { visit: ["Already has one."] }),
    );
    const onRefused = vi.fn();
    renderWithIntl(
      <RecordAction
        visitId={7}
        status="none"
        encounterId={null}
        onRefused={onRefused}
      />,
    );
    start();

    await screen.findByText("Already has one.");
    expect(onRefused).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("keeps the API's message once the list shows the existing record", async () => {
    startEncounter.mockResolvedValue(
      refused(422, { visit: ["Already has one."] }),
    );
    const { rerender } = renderWithIntl(
      <RecordAction visitId={7} status="none" encounterId={null} />,
    );
    start();
    await screen.findByText("Already has one.");

    rerender(
      <NextIntlClientProvider
        locale="en"
        messages={messagesByLocale.en}
        timeZone="Africa/Cairo"
      >
        <RecordAction visitId={7} status="draft" encounterId={3} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Already has one.")).not.toBeNull();
    expect(screen.getByRole("link", { name: t.continue })).not.toBeNull();
  });

  it("refreshes the page if no one else reads the list", async () => {
    startEncounter.mockResolvedValue(refused(422, { visit: ["No."] }));
    renderWithIntl(
      <RecordAction visitId={7} status="none" encounterId={null} />,
    );
    start();
    await screen.findByText("No.");
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("says it isn't known when no answer comes", async () => {
    startEncounter.mockResolvedValue(refused(0));
    renderWithIntl(
      <RecordAction visitId={7} status="none" encounterId={null} />,
    );
    start();
    await screen.findByText(t.startUnknown);
    expect(startEncounter).toHaveBeenCalledOnce();
  });

  it("links to a draft, without prefetching", () => {
    renderWithIntl(<RecordAction visitId={7} status="draft" encounterId={3} />);
    const link = screen.getByRole("link", { name: t.continue });
    expect(link.getAttribute("href")).toBe("/en/my/encounters/3");
  });

  it("links to a finalized record, and marks a click as asked for", () => {
    renderWithIntl(
      <RecordAction visitId={7} status="finalized" encounterId={4} />,
    );
    const link = screen.getByRole("link", { name: t.open });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(recordOpening.takeAsked(4)).toBe(true);
  });
});
