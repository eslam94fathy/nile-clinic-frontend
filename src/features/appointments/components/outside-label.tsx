import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

/** Text, never color alone. The appointment still stands: this isn't a status. */
export function OutsideLabel() {
  const t = useTranslations("appointments");

  return (
    <Badge
      variant="outline"
      className="border-status-warning-border bg-status-warning text-status-warning-foreground"
    >
      {t("outsideLabel")}
    </Badge>
  );
}
