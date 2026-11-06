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
