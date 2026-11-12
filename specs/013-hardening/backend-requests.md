# Requests to the backend's owner

Three changes only the backend can make, found while preparing production. Nothing in the backend was changed by this phase. Checked at
the backend's commit `dff2dca`.

## B1. Trust the frontend's address, so that each computer is seen separately (hazard H2)

**What to change**: in `bootstrap/app.php`, inside `withMiddleware`, add
`$middleware->trustProxies(at: ['<the frontend container's address or subnet>']);`. With the deployment in
[docs/deployment.md](../../docs/deployment.md), that is the address the frontend container has on the `nile-clinic_default` network.
Trust no wider range than that.

**Why**: every request reaches the backend through the frontend's server. Today `request()->ip()` is therefore always the frontend's
address, so:

- every audit entry's `network_address` is the frontend's, not the clinic computer's (`app/Modules/Audit/Services/AuditTrail.php:109`);
- all staff share one sign-in limit of 20 attempts per minute (`app/Modules/Staff/Http/Controllers/AuthController.php:28`), so one person
  can lock out the whole clinic.

**Already done on the frontend's side**: since Phase 13, the frontend passes the client's address on in `X-Forwarded-For`, exactly as the
reverse proxy set it, and the proxy replaces rather than appends it. Until the backend trusts the frontend, it ignores that header, so
nothing changes before this request is done.

**How to check once done**: sign in from two computers; the audit trail shows two different network addresses. Twenty attempts in a minute
from one computer don't stop another computer from signing in. (The limit of five failures per email applies to any address, as
before.)

## B2. A version check when saving a draft (gap G9)

**What to change**: let `PUT /doctors/me/encounters/{encounter}` (`saveEncounter`, saving a draft) take the version the doctor
started from (for example the `updated_at` they read), and refuse with `409` and a `reason` when the draft has changed since.

**Why**: with one draft open in two tabs, the last save wins with no warning, and finalizing locks whatever was saved last, which may be the
other tab's. The frontend can only say so after finalizing; it can't warn before. Confirmed on the running API in Phase 8.

**How to check once done**: open one draft in two tabs, save in one, then save in the other: the second is refused with `409`.

## B3. Keep the clinic's time zone the same in both applications (hazard H4)

**What to change**: nothing in code. In deployment, set the backend's `CLINIC_TIMEZONE` and the frontend's `CLINIC_TIMEZONE` to the same
value, and change them together.

**Why**: no endpoint returns the clinic's time zone, so the frontend keeps its own copy to show times and to know what "today" is.

**How to check once done**: both settings show the same value; an appointment booked at 09:00 shows at 09:00 on every screen.
