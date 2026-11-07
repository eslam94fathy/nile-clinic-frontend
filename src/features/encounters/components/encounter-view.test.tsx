import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  messagesByLocale,
  renderWithIntl,
} from "@/test-support/render-with-intl";
import { finalized } from "../test-support";
import { EncounterView } from "./encounter-view";

afterEach(cleanup);

const t = messagesByLocale.en.encounters;

const show = (record = finalized) =>
  renderWithIntl(<EncounterView record={record} timeZone="Africa/Cairo" />);

describe("EncounterView", () => {
  it("shows the text as written, labelling what's empty", () => {
    show();
    expect(screen.getByText("Synthetic diagnosis")).not.toBeNull();
    expect(screen.getAllByText(t.view.empty).length).toBeGreaterThan(0);
  });

  it("names the author, and gives the time in the clinic's zone", () => {
    show();
    const line = screen.getByText(/Written by/);
    expect(line.textContent).toContain("Consultant Synthetic Doctor");
    // 09:00 UTC is 11:00 in Cairo in November.
    expect(line.textContent).toMatch(/11:00/);
  });

  it("shows each line's fields, and says when there are none", () => {
    show({
      ...finalized,
      prescriptions: [
        {
          medication: "Synthetic medicine",
          dosage: "One",
          frequency: "Daily",
          duration: "A week",
          instructions: null,
        },
      ],
    });
    expect(screen.getByText("Synthetic medicine")).not.toBeNull();
    expect(screen.getByText("A week")).not.toBeNull();
    expect(screen.queryByText(t.view.noLines)).toBeNull();
    cleanup();

    show();
    expect(screen.getByText(t.view.noLines)).not.toBeNull();
  });

  it("gives its status, visit date, and when it was started and last saved", () => {
    show();
    const line = screen.getByText(/Written by/);
    expect(line.textContent).toContain(t.visitDate);
    expect(line.textContent).toContain("2026-11-07");
    expect(line.textContent).toContain(t.started);
    expect(line.textContent).toContain(t.lastSaved);
    expect(
      screen.getByText(messagesByLocale.en.shared.status.record.finalized),
    ).not.toBeNull();
  });

  it("offers nothing to change", () => {
    show();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows no field for anything but the patient's summary", () => {
    show();
    expect(document.body.textContent).not.toMatch(/phone|national/i);
  });
});
