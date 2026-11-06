import { z } from "zod";

/**
 * A standard list's `meta`, confirmed on the running API (research R1). The contracts leave it untyped.
 * The same-origin route removes `links` and `path`, which hold the API's private address.
 */
export type PageMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

const pageMetaSchema = z.object({
  current_page: z.number(),
  last_page: z.number(),
  per_page: z.number(),
  total: z.number(),
  from: z.number().nullable(),
  to: z.number().nullable(),
}) satisfies z.ZodType<PageMeta>;

export function pageSchema<Item extends z.ZodType>(item: Item) {
  return z.object({ data: z.array(item), meta: pageMetaSchema });
}

export function itemSchema<Item extends z.ZodType>(item: Item) {
  return z.object({ data: item });
}

/** Builds a page's address, from the filters it was opened with, for the table's page links. */
export function pageHref(
  pathname: string,
  filters: Record<string, string | undefined>,
): (page: number) => string {
  return (page) => {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(filters)) {
      if (value) query.set(name, value);
    }
    query.set("page", String(page));
    return `${pathname}?${query.toString()}`;
  };
}
