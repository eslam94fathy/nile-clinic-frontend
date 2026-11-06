# Contract: App Shell

What later phases can rely on, and the rules they must follow.

## Adding a signed-in page

1. Add the route's folder under `app/[locale]/(app)/`. It takes priority over the catch-all.
2. Set `built: true` on its row in `lib/auth/app-routes.ts`, or add a row if it's new. The table is what makes the proxy treat the address as signed-in.
3. Wrap **all** of the page's content:

```tsx
export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ScreenGate locale={locale} path="patients">
        {/* Everything here. Anything outside the gate enters the public static shell. */}
      </ScreenGate>
    </Suspense>
  );
}
```

## `ScreenGate`

Server Component. Props: `locale`, `path` (a key of the route table), and `children`.

| Situation | Renders |
|---|---|
| No session, or `401` | Nothing visible; starts the session end |
| API failing | `ErrorState`, with retry |
| Role not allowed | `ForbiddenState`. Children are never rendered or sent |
| Doctor on a doctor-area route, with `GET /doctors/me` giving `404` | The no-profile state |
| Doctor, with that call giving `403` | `ForbiddenState` |
| Doctor, with that call failing otherwise | `ErrorState`, with retry |
| Allowed | Children, plus the role sync |

Also runs on soft navigation, as pages re-render and layouts don't.

## Server reads

`lib/api/server-api.ts` is the only server path to the API, except the auth routes. It waits for `connection()` first, so prefetching can't reach it. Don't call `fetch` to the backend anywhere else, and never use `use cache` or `use cache: private` on what it returns.

The current user is read through a per-render `cache()`, so a shell and a gate share one call.

## API errors on a screen

A screen that gets `401`, `403`, or `404` from a later call uses, respectively, the session end, `ForbiddenState`, and `NotFoundState`. `403` wins over the role map.

## `can` and `Can`

```tsx
can(role, "manageDoctors");          // Anywhere

<Can capability="manageDoctors">     // Client or server children inside the shell, using its role
  <Button>…</Button>
</Can>
```

These affect what's shown, and are never a security decision.

## Session end

`endSession()` in `lib/auth/session-end.ts` is the single entry point. It:

1. Does nothing if an end is already under way, so simultaneous failures redirect once.
2. Tells other tabs through a `BroadcastChannel`.
3. Does a full `location.replace`, so memory and hidden screens are cleared.

Later phases that add a client cache must clear it here. A tab that gets the message does the full navigation itself.

A page restored from the browser's back-forward cache reloads, and the server decides from there.

## Sign-out

The top bar's control `POST`s to the sign-out route with progress shown, then calls the session end. If the application's own server can't be reached, the cookie can't be cleared, so the person stays on the page and sees a failure notice. Pretending otherwise would leave a live session on a shared computer.

## Navigation

- The list comes from the route table, through `canOpen(role, route)`, in the table's order.
- The current page has `aria-current="page"` and a non-color indicator.
- Language, theme, account, and sign-out are in the top bar for everyone.
- On narrow screens, the same links are in a keyboard-operable menu.

## Placeholder

`[...section]/page.tsx` looks the path up in the table. An unknown path gives `notFound()`, inside the frame. A row with `built: false` goes through the normal gate, then shows "not available yet", and makes no feature API call.

## Address rules in the proxy

| Address | No cookie | Cookie |
|---|---|---|
| `/{locale}` | Redirect to sign-in | Redirect to `dashboard` |
| `sign-in` | Public | The page itself redirects if the session is valid |
| A route table path | Redirect to sign-in, with `return` | Page, whose gate decides |
| Design preview, when enabled | Public | Public |
| Design preview, when off | Treated as unknown | Treated as unknown |
| Unknown | Rewrite to the public not-found page: real `404` | Framed not-found state: status `200`, see research R8 |

A cookie's presence is all the proxy looks at. It's never a security decision. Never re-create the request there.
