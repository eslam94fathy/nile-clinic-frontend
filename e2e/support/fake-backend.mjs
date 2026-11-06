// Stands in for the backend in end-to-end tests. The application calls the backend from the server, where
// browser-level interception can't reach, so tests control this process over HTTP. All data is synthetic.
import { randomUUID } from "node:crypto";
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

// Accounts. Tokens carry a sentinel, so that tests can search for them anywhere.
const TOKEN_SENTINEL = "SENTINEL-TOKEN";
const PASSWORD = "synthetic-password-1";

function freshAccounts() {
  const account = (id, name, role, hasProfile = false) => ({
    id,
    name,
    email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
    role,
    is_active: true,
    password: PASSWORD,
    hasProfile,
    created_at: "2026-01-01T00:00:00+00:00",
    updated_at: "2026-01-01T00:00:00+00:00",
  });

  return [
    account(1, "Synthetic Admin", "administrator"),
    account(2, "Synthetic Reception", "receptionist"),
    account(3, "Synthetic Doctor", "doctor", true),
    account(4, "Synthetic Newdoctor", "doctor"),
  ];
}

let accounts = freshAccounts();
let tokens = new Map();
let scripted = new Map();
let calls = {};

const REFUSED = {
  en: "These credentials do not match our records.",
  ar: "بيانات الدخول هذه غير صحيحة.",
};
const WRONG_PASSWORD = {
  en: "The password is incorrect.",
  ar: "كلمة المرور غير صحيحة.",
};
const UNAUTHENTICATED = { en: "Unauthenticated.", ar: "لم تقم بتسجيل الدخول." };

const language = (request) =>
  request.headers["accept-language"] === "ar" ? "ar" : "en";

function publicUser(account) {
  const user = { ...account };
  delete user.password;
  delete user.hasProfile;
  return user;
}

function currentAccount(request) {
  const token = /^Bearer (.+)$/.exec(request.headers.authorization ?? "")?.[1];
  return accounts.find(({ id }) => id === tokens.get(token));
}

function readJson(request) {
  return new Promise((resolve) => {
    let text = "";
    request.on("data", (chunk) => (text += chunk));
    request.on("end", () => {
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve({});
      }
    });
  });
}

const routes = {
  "POST auth/sign-in": async (request, response) => {
    const { email, password } = await readJson(request);

    if (email === "throttled@example.test") {
      const message = "Too many attempts. Try again in 47 seconds.";
      return send(response, 422, { message, errors: { email: [message] } });
    }

    const found = accounts.find((account) => account.email === email);
    if (!found?.is_active || found.password !== password) {
      const message = REFUSED[language(request)];
      return send(response, 422, { message, errors: { email: [message] } });
    }

    const token = `${found.id}|${TOKEN_SENTINEL}-${randomUUID()}`;
    tokens.set(token, found.id);
    return send(response, 200, {
      data: { token, token_type: "Bearer", user: publicUser(found) },
    });
  },
  "POST auth/sign-out": (request, response) => {
    const token = request.headers.authorization?.slice("Bearer ".length);
    tokens.delete(token);
    response.writeHead(204);
    response.end();
  },
  "GET auth/me": (_request, response, me) =>
    send(response, 200, { data: publicUser(me) }),
  "PUT auth/password": async (request, response, me) => {
    const { current_password: current, password } = await readJson(request);

    if (current !== me.password) {
      const message = WRONG_PASSWORD[language(request)];
      return send(response, 422, {
        message,
        errors: { current_password: [message] },
      });
    }

    const mine = request.headers.authorization.slice("Bearer ".length);
    for (const [token, id] of tokens) {
      if (id === me.id && token !== mine) tokens.delete(token);
    }
    me.password = password;
    response.writeHead(204);
    response.end();
  },
  "GET doctors/me": (_request, response, me) => {
    if (me.role !== "doctor") return send(response, 403, { message: "No." });
    return me.hasProfile
      ? send(response, 200, { data: { id: me.id, title: "Dr" } })
      : send(response, 404, { message: "Not found." });
  },
  "GET staff": (_request, response) => {
    const here = `http://127.0.0.1:${port}/api/v1/staff`;
    send(response, 200, {
      data: accounts.map(publicUser),
      links: { first: `${here}?page=1`, last: here, prev: null, next: null },
      meta: {
        current_page: 1,
        from: 1,
        last_page: 1,
        links: [{ url: here, label: "1", page: 1, active: true }],
        path: here,
        per_page: 15,
        to: 4,
        total: 4,
      },
    });
  },
};

function control(pathname, query, response) {
  const find = () => accounts.find(({ email }) => email === query.get("email"));

  switch (pathname) {
    case "/__control/reset":
      accounts = freshAccounts();
      tokens = new Map();
      scripted = new Map();
      calls = {};
      return send(response, 200, {});
    case "/__control/calls":
      return send(response, 200, calls);
    case "/__control/calls/clear":
      calls = {};
      return send(response, 200, {});
    case "/__control/script":
      // The next requests to this endpoint get this status, until it's scripted to 0.
      if (query.get("status") === "0") scripted.delete(query.get("endpoint"));
      else scripted.set(query.get("endpoint"), Number(query.get("status")));
      return send(response, 200, {});
    case "/__control/revoke":
      for (const [token, id] of tokens) {
        if (id === find()?.id) tokens.delete(token);
      }
      return send(response, 200, {});
    case "/__control/account": {
      const account = find();
      if (query.has("role")) account.role = query.get("role");
      if (query.has("name")) account.name = query.get("name");
      if (query.has("profile")) {
        account.hasProfile = query.get("profile") === "true";
      }
      return send(response, 200, {});
    }
    default:
      return send(response, 404, {});
  }
}

createServer(async (request, response) => {
  const { pathname, searchParams } = new URL(request.url, "http://localhost");

  if (pathname === "/__control/stats") return send(response, 200, stats);

  if (pathname.startsWith("/__control/mode/")) {
    const requested = pathname.slice("/__control/mode/".length);
    if (!behaviors[requested]) return send(response, 400, { error: requested });
    mode = requested;
    stats = { count: 0, acceptLanguage: null };
    return send(response, 200, { mode });
  }

  if (pathname.startsWith("/__control/")) {
    return control(pathname, searchParams, response);
  }

  if (pathname === "/redirected-ok") return send(response, 200, healthy);

  if (pathname === "/api/v1/health") {
    stats = {
      count: stats.count + 1,
      acceptLanguage: request.headers["accept-language"] ?? null,
    };
    return behaviors[mode](request, response);
  }

  const endpoint = pathname.slice("/api/v1/".length);
  const route = routes[`${request.method} ${endpoint}`];
  if (!route) return send(response, 404, { message: "Not found" });

  calls[endpoint] = (calls[endpoint] ?? 0) + 1;

  const status = scripted.get(endpoint);
  if (status === -1) return request.socket.destroy();
  if (status) {
    return send(response, status, { message: `Scripted ${status}.` });
  }

  if (endpoint === "auth/sign-in") return route(request, response);

  const me = currentAccount(request);
  if (!me) {
    return send(response, 401, { message: UNAUTHENTICATED[language(request)] });
  }
  return route(request, response, me);
}).listen(port, "127.0.0.1");
