import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  isKnownStatus,
  type StatusKind,
  type StatusTone,
  type StatusValue,
  toneOf,
} from "./status-mapping";

const toneClasses: Record<StatusTone, string> = {
  neutral:
    "border-status-neutral-border bg-status-neutral text-status-neutral-foreground",
  active:
    "border-status-active-border bg-status-active text-status-active-foreground",
  success:
    "border-status-success-border bg-status-success text-status-success-foreground",
  warning:
    "border-status-warning-border bg-status-warning text-status-warning-foreground",
  muted:
    "border-status-muted-border bg-status-muted text-status-muted-foreground",
};

export function StatusBadge<Kind extends StatusKind>({
  kind,
  value,
}: {
  kind: Kind;
  value: StatusValue<Kind>;
}) {
  const t = useTranslations("shared.status");
  // The type stops a wrong value at build time. A newer backend can still send one at run time.
  const status = String(value);
  const key: string = `${kind}.${status}`;
  const label = isKnownStatus(kind, status) ? t(key) : t("unknown");

  return (
    <Badge
      variant="outline"
      data-tone={toneOf(kind, status)}
      className={`h-auto min-h-5 py-0.5 text-[0.8125rem] ${toneClasses[toneOf(kind, status)]}`}
    >
      {label}
    </Badge>
  );
}
