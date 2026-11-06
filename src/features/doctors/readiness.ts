export type ItemState = "complete" | "incomplete" | "unknown";
export type ReadinessFact = boolean | "unknown";

export type ReadinessInput = {
  active: boolean;
  /** `unknown` wherever the read behind it failed. */
  hasPeriods: ReadinessFact;
  slotCount: number | "unknown";
  hasFee: ReadinessFact;
};

export type Readiness = {
  items: {
    account: ItemState;
    hours: ItemState;
    slots: ItemState;
    fee: ItemState;
  };
  /** Only the API's slots decide this. Nothing here works it out independently. */
  bookable: ReadinessFact;
  setupComplete: ReadinessFact;
  chargeWarning: boolean;
};

function stateOf(fact: ReadinessFact): ItemState {
  if (fact === "unknown") return "unknown";
  return fact ? "complete" : "incomplete";
}

/** A claim is withheld only when it depends on something that couldn't be read (FR-002). */
export function readinessOf(input: ReadinessInput): Readiness {
  const bookable: ReadinessFact =
    input.slotCount === "unknown" ? "unknown" : input.slotCount > 0;

  let setupComplete: ReadinessFact;
  if (bookable === false || input.hasFee === false) setupComplete = false;
  else if (bookable === "unknown" || input.hasFee === "unknown") {
    setupComplete = "unknown";
  } else setupComplete = true;

  return {
    items: {
      account: stateOf(input.active),
      hours: stateOf(input.hasPeriods),
      slots: stateOf(bookable),
      fee: stateOf(input.hasFee),
    },
    bookable,
    setupComplete,
    chargeWarning: bookable === true && input.hasFee === false,
  };
}
