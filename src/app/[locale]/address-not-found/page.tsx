import { notFound } from "next/navigation";

// `src/proxy.ts` sends an unknown address here when there's no session. The route under `(app)` can't
// serve it, because its frame needs someone signed in.
export default function AddressNotFound() {
  notFound();
}
