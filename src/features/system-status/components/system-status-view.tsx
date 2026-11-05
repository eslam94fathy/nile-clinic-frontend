import { CheckAgainButton } from "./check-again-button";

type SystemStatusViewProps = {
  state: "checking" | "working" | "unavailable" | "unreachable";
  label: string;
  detail?: string;
  retry?: { checkAgain: string; checking: string };
};

export function SystemStatusView({
  state,
  label,
  detail,
  retry,
}: SystemStatusViewProps) {
  const canRetry = state === "unavailable" || state === "unreachable";

  return (
    <section className="flex flex-col items-start gap-2 rounded border border-neutral-300 p-4">
      <p className="font-medium">{label}</p>
      {detail ? <p className="text-sm text-neutral-700">{detail}</p> : null}
      {canRetry && retry ? (
        <CheckAgainButton
          label={retry.checkAgain}
          pendingLabel={retry.checking}
        />
      ) : null}
    </section>
  );
}
