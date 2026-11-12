/**
 * Whether the frontend server is serving, for Docker's health check (ADR 0022). It reads no cookie, no setting,
 * and calls nothing: the backend's state is the System status page's, so its outage can't restart the frontend.
 */
export function GET() {
  return Response.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
