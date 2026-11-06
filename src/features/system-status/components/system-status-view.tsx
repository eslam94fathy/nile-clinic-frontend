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
    <section className="flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-card-foreground">
      <p className="font-medium">{label}</p>
      {detail ? (
        <p className="text-sm text-muted-foreground">{detail}</p>
      ) : null}
      {canRetry && retry ? (
        <CheckAgainButton
          label={retry.checkAgain}
          pendingLabel={retry.checking}
        />
      ) : null}
    </section>
  );
}
