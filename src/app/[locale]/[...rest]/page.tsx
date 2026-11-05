import { notFound } from "next/navigation";

// Sends unknown paths under a language to that language's not-found page.
export default function UnknownPath() {
  notFound();
}
