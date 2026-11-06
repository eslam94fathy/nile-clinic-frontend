import { isRecord } from "./api-error";

/**
 * Paginated lists carry absolute addresses of the private API, which repeat the request's query string
 * (research R2). Screens page by number, so these fields never reach the browser.
 */
export function stripPageLinks(body: unknown): unknown {
  if (!isRecord(body)) return body;

  const stripped = { ...body };
  delete stripped.links;

  if (isRecord(stripped.meta)) {
    const meta = { ...stripped.meta };
    delete meta.links;
    delete meta.path;
    stripped.meta = meta;
  }
  return stripped;
}
