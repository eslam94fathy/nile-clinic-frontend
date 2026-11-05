import { describe, expect, it } from "vitest";
import { findPhysicalStyles } from "./check-logical-styles.mjs";

describe("findPhysicalStyles", () => {
  it.each([
    'className="ml-4"',
    'className="p-2 mr-auto"',
    'className="md:pl-2"',
    'className="hover:pr-[3px]"',
    'className="-ml-1"',
    'className="left-0"',
    'className="right-2"',
    'className="text-left"',
    'className="text-right"',
    'className="float-left"',
    'className="border-l"',
    'className="border-r-2"',
    'className="rounded-l-md"',
    'className="rounded-tr"',
    "margin-left: 1rem;",
    "padding-right: 1rem;",
    "border-left: 1px solid;",
    "text-align: right;",
    "float: left;",
    "  left: 0;",
    "border-left-width: 1px;",
    "border-top-left-radius: 2px;",
    "* { margin-left: 0; }",
    'className="border-l-neutral-300"',
    'className="ml-(--gap)"',
    'className="rounded-l-xs"',
    "style={{ marginLeft: 8 }}",
    "style={{ paddingRight: 8 }}",
    "style={{ borderLeftWidth: 1 }}",
    "style={{ left: 0 }}",
    "style={{ top: 0, right: 0 }}",
    'style={{ textAlign: "left" }}',
  ])("finds %s", (text) => {
    expect(findPhysicalStyles(text)).toHaveLength(1);
  });

  it.each([
    'className="ms-4 me-2 ps-1 pe-1 start-0 end-0 text-start text-end"',
    'className="border-s rounded-e-md"',
    "margin-inline-start: 1rem;",
    "text-align: start;",
    "// a comment saying left-to-right",
    "/* margin-left: 1rem; */",
    " * margin-left is mentioned in a block comment",
    "style={{ marginInlineStart: 8 }}",
    'const direction = "left-to-right is described here";',
  ])("accepts %s", (text) => {
    expect(findPhysicalStyles(text)).toEqual([]);
  });

  it("reports the line number", () => {
    const [found] = findPhysicalStyles('a\nb\nclassName="ml-4"');
    expect(found?.line).toBe(3);
    expect(found?.match).toBe("ml-4");
  });
});
