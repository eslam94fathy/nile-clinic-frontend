// Stands in for the backend in end-to-end tests. The landing page calls the backend from the
// server, where browser-level interception can't reach, so tests control this process over HTTP.
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3111);
const healthy = { status: "ok", checks: { database: "ok" } };
const down = { status: "unavailable", checks: { database: "unavailable" } };

let mode = "ok";
let stats = { count: 0, acceptLanguage: null };

function send(response, status, body, type = "application/json") {
  response.writeHead(status, { "content-type": type });
  response.end(typeof body === "string" ? body : JSON.stringify(body));
}

const behaviors = {
  ok: (_request, response) => send(response, 200, healthy),
  unavailable: (_request, response) => send(response, 503, down),
  "ok-with-unavailable-body": (_request, response) => send(response, 200, down),
  "html-404": (_request, response) =>
    send(response, 404, "<html><body>Not Found</body></html>", "text/html"),
  "bad-shape": (_request, response) => send(response, 200, { status: "ok" }),
  redirect: (_request, response) => {
    // If this were followed, the page would wrongly report "working".
    response.writeHead(302, { location: "/redirected-ok" });
    response.end();
  },
  hang: () => {},
  slow: (_request, response) =>
    setTimeout(() => send(response, 200, healthy), 2000),
  destroy: (request) => request.socket.destroy(),
};

createServer((request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");

  if (pathname === "/__control/stats") return send(response, 200, stats);

  if (pathname.startsWith("/__control/mode/")) {
    const requested = pathname.slice("/__control/mode/".length);
    if (!behaviors[requested]) return send(response, 400, { error: requested });
    mode = requested;
    stats = { count: 0, acceptLanguage: null };
    return send(response, 200, { mode });
  }

  if (pathname === "/redirected-ok") return send(response, 200, healthy);

  if (pathname === "/api/v1/health") {
    stats = {
      count: stats.count + 1,
      acceptLanguage: request.headers["accept-language"] ?? null,
    };
    return behaviors[mode](request, response);
  }

  return send(response, 404, { message: "Not found" });
}).listen(port, "127.0.0.1");
