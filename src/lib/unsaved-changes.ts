/** What a form offers while it has something to lose. It never holds the text itself. */
export type UnsavedHolder = {
  discard: () => void;
  /** Asks the person. `leave` discards, then carries on with what they were doing. */
  ask: (leave: () => void) => void;
  /** Another tab found that the session ended by itself, and nobody chose that. */
  sessionEnded: () => void;
};

let holder: UnsavedHolder | null = null;
let aside = false;

/** Returns the way to let go. A form calls this while changed and shown, so a hidden page holds nothing. */
export function holdUnsaved(next: UnsavedHolder): () => void {
  holder = next;
  return () => {
    if (holder === next) holder = null;
  };
}

export function hasUnsaved(): boolean {
  return holder !== null && !aside;
}

/** Anything that leaves the page without being a link, such as signing out, comes through here first. */
export function askBeforeLeaving(proceed: () => void): void {
  if (!holder || aside) {
    proceed();
    return;
  }

  const asking = holder;
  asking.ask(() => {
    if (holder === asking) holder = null;
    asking.discard();
    proceed();
  });
}

/**
 * For something that may fail and stay on the page, such as signing out. Nothing is discarded, as a full page load
 * clears it anyway if it succeeds, and the text must still be there if it doesn't.
 */
export function askWithoutDiscarding(proceed: () => void): void {
  if (!holder || aside) {
    proceed();
    return;
  }
  holder.ask(proceed);
}

/** Says whether anything is holding on, in which case it has been told, and the page stays. */
export function tellSessionEnded(): boolean {
  if (!holder || aside) return false;
  holder.sessionEnded();
  return true;
}

/** A session is really ending, so the page is about to leave, and nothing may stop it. */
export function standAside(): void {
  aside = true;
}

export function resetUnsavedForTests(): void {
  holder = null;
  aside = false;
}
