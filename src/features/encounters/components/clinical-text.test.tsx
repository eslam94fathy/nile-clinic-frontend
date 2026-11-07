import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { ClinicalText } from "./clinical-text";

afterEach(cleanup);

const show = (value: string | null) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ClinicalText value={value} />
    </NextIntlClientProvider>,
  ).container;

describe("ClinicalText", () => {
  it("keeps text and line breaks as written", () => {
    const text = show("One\n\nشكوى تجريبية").querySelector("p");
    expect(text?.textContent).toBe("One\n\nشكوى تجريبية");
    expect(text?.className).toContain("whitespace-pre-wrap");
  });

  it("takes its own direction, and asks not to be translated", () => {
    const text = show("Synthetic").querySelector("p");
    expect(text?.getAttribute("dir")).toBe("auto");
    expect(text?.getAttribute("translate")).toBe("no");
  });

  it("shows markup as text, so it can't run", () => {
    const planted = '<img src=x onerror="alert(1)"><b>bold</b>';
    const box = show(planted);
    expect(box.querySelector("img")).toBeNull();
    expect(box.querySelector("b")).toBeNull();
    expect(screen.getByText(planted)).not.toBeNull();
  });

  it("labels nothing as empty", () => {
    show(null);
    expect(screen.getByText(en.encounters.view.empty)).not.toBeNull();
  });
});
